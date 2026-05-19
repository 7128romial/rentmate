import sys
import pandas as pd
from app import app, db
from models import User, PreferenceProfile

def run_import():
    users_path = '../data/1_users_1000.xlsx'
    seekers_path = '../data/3_seekers_1000.xlsx'
    
    print("Reading Seekers Excel file...")
    df_users = pd.read_excel(users_path)
    df_seekers = pd.read_excel(seekers_path)
    
    with app.app_context():
        print("Importing seekers and their preferences...")
        added_count = 0
        
        for _, row in df_seekers.iterrows():
            user_id_excel = row['user_id']
            # Find the user's email from the users dataframe
            user_row = df_users[df_users['user_id'] == user_id_excel]
            if user_row.empty:
                continue
            username = user_row.iloc[0]['username']
            email = f"{username}@example.com"
            
            user = User.query.filter_by(email=email).first()
            if not user:
                continue
                
            # Update role to renter (since the previous script made everyone a landlord)
            user.role = 'renter'
            
            # Create or update preference profile
            pref = PreferenceProfile.query.filter_by(user_id=user.id).first()
            if not pref:
                pref = PreferenceProfile(user_id=user.id)
                db.session.add(pref)
                
            pref.name = username
            pref.city = row['preferred_city']
            pref.max_budget = row['max_budget']
            
            # Convert boolean preferences to text for the 'extras' field
            extras = []
            if row['requires_parking']: extras.append('חניה')
            if row['requires_elevator']: extras.append('מעלית')
            if row['requires_mamad']: extras.append('ממ"ד')
            if row['allows_pets']: extras.append('חיות מחמד')
            
            pref.extras = ", ".join(extras) if extras else ""
            
            added_count += 1
            if added_count % 100 == 0:
                print(f"Processed {added_count} seekers...")
                db.session.commit()
                
        db.session.commit()
        print(f"Successfully updated {added_count} users as seekers with preferences!")

if __name__ == '__main__':
    run_import()
