import os
import json
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import openai

app = Flask(__name__)
CORS(app)

# --- cPanel / MySQL Setup ---
# When moving to cPanel, use: app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://user:pass@localhost/db_name'
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'rentmate_v3.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'rentmate-secret'

db = SQLAlchemy(app)

# Import models after db is defined
import models

with app.app_context():
    db.create_all()

# --- API ENDPOINTS ---

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    phone = data.get('phone')
    if not phone:
        return jsonify({'error': 'Phone number required'}), 400
    
    # Generate mock OTP
    return jsonify({'message': 'OTP sent', 'otp': '1234', 'phone': phone})

@app.route('/api/auth/verify', methods=['POST'])
def verify():
    data = request.json
    phone = data.get('phone')
    otp = data.get('otp')
    if not phone or not otp:
        return jsonify({'error': 'Missing credentials'}), 400
    
    user = models.User.query.filter_by(phone=phone).first()
    if not user:
        user = models.User(phone=phone, role='renter')
        db.session.add(user)
        db.session.commit()
    
    return jsonify({'message': 'Verified', 'user_id': user.id})

@app.route('/api/profile', methods=['POST'])
def update_profile():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = models.PreferenceProfile(user_id=user_id)
        db.session.add(profile)
    
    profile.name = data.get('name')
    profile.city = data.get('city')
    
    budget_str = data.get('budget', '')
    import re
    nums = re.findall(r'\d+', budget_str)
    budget = int(nums[0]) if nums else 4500
    if budget < 100: budget *= 1000
    
    profile.max_budget = budget
    profile.type = data.get('type')
    profile.extras = data.get('extras')
    
    db.session.commit()
    return jsonify({'message': 'Profile saved'})

@app.route('/api/properties', methods=['GET'])
def get_properties():
    user_id = request.args.get('user_id')
    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
    
    city = profile.city if profile and profile.city else 'תל אביב'
    base_price = profile.max_budget if profile and profile.max_budget > 0 else 4500
    
    # Create dynamic properties if none exist for this city
    props = models.Property.query.filter_by(location=city).all()
    if not props:
        prop1 = models.Property(
            title=f"סטודיו מואר ב{city}",
            price=base_price,
            location=city,
            image="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
            tags="שקט,משופצת"
        )
        prop2 = models.Property(
            title=f"דירה מהממת ב{city}",
            price=base_price + 350,
            location=city,
            image="https://images.unsplash.com/photo-1502672260266-1c1de2d93688?auto=format&fit=crop&w=600&q=80",
            tags="מרווחת,זוגות"
        )
        prop3 = models.Property(
            title=f"לופט יוקרתי ליד הים",
            price=base_price + 1200,
            location=city,
            image="https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80",
            tags="פרימיום,מרפסת"
        )
        db.session.add_all([prop1, prop2, prop3])
        db.session.commit()
        props = [prop1, prop2, prop3]
        
    result = []
    for p in props:
        result.append({
            'id': p.id,
            'title': p.title,
            'price': f"₪{p.price:,}/חודש",
            'image': p.image,
            'matchScore': 98 if p.price <= base_price else 88,
            'tags': p.tags.split(',')
        })
        
    return jsonify(result)

@app.route('/api/swipe', methods=['POST'])
def swipe():
    data = request.json
    user_id = data.get('user_id')
    property_id = data.get('property_id')
    direction = data.get('direction') # 'right' or 'left'
    
    if not user_id or not property_id or not direction:
        return jsonify({'error': 'Missing fields'}), 400
        
    swipe = models.Swipe(user_id=user_id, property_id=property_id, direction=direction)
    db.session.add(swipe)
    
    is_match = False
    if direction in ['right', 'up']:
        # Mock mutual match for demo purposes
        match = models.Match(user_id=user_id, property_id=property_id)
        db.session.add(match)
        is_match = True
        
    db.session.commit()
    return jsonify({'success': True, 'isMatch': is_match})

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_id = data.get('user_id')
    text = data.get('text')
    if not user_id or not text:
        return jsonify({'error': 'Missing fields'}), 400
        
    # Save user message
    user_msg = models.ChatMessage(user_id=user_id, role='user', content=text)
    db.session.add(user_msg)
    db.session.commit()
    
    # Fetch history
    history = models.ChatMessage.query.filter_by(user_id=user_id).order_by(models.ChatMessage.created_at).all()
    messages = [
        {"role": "system", "content": "You are RentMate AI. Ask the user questions to discover their apartment preferences (budget, city, roommates, etc). Be friendly, short, and conversational. Speak in Hebrew. When you have enough info to create a profile, output a JSON object starting with 'PROFILE_JSON=' followed by the JSON string containing: {'name', 'city', 'budget', 'type', 'extras'}. Do NOT output the JSON until you are sure you have at least a city and budget."}
    ]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
        
    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        openai.api_key = api_key
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=messages
            )
            ai_text = response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI Error: {e}")
            ai_text = "סליחה, יש לי קצת עומס במערכת. תוכל לחזור על זה?"
    else:
        # Mock AI response if no key
        if 'תל אביב' in text or '5000' in text:
            ai_text = 'PROFILE_JSON={"name":"משתמש","city":"תל אביב","budget":5000,"type":"לבד","extras":"מרפסת"}'
        else:
            ai_text = "מעולה! איפה היית רוצה לגור ומה התקציב שלך? (גרסת דמו)"
            
    # Check for profile extraction
    profile_complete = False
    if 'PROFILE_JSON=' in ai_text:
        json_str = ai_text.split('PROFILE_JSON=')[1].strip()
        try:
            profile_data = json.loads(json_str)
            profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
            if not profile:
                profile = models.PreferenceProfile(user_id=user_id)
                db.session.add(profile)
            profile.name = profile_data.get('name', 'משתמש')
            profile.city = profile_data.get('city', 'תל אביב')
            profile.max_budget = int(profile_data.get('budget', 4500))
            profile.type = profile_data.get('type', '')
            profile.extras = profile_data.get('extras', '')
            db.session.commit()
            profile_complete = True
            ai_text = "מעולה! בניתי לך פרופיל אישי. מעביר אותך לדירות..."
        except:
            ai_text = "הייתה בעיה בשמירת הפרופיל, בוא ננסה שוב."
            
    # Save AI message
    ai_msg = models.ChatMessage(user_id=user_id, role='assistant', content=ai_text)
    db.session.add(ai_msg)
    db.session.commit()
    
    return jsonify({'response': ai_text, 'profile_complete': profile_complete})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
