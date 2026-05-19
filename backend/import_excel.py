import sys
import pandas as pd
from app import app, db
from models import User, Property

def run_import():
    users_path = '../DATA/1_users_1000.xlsx'
    apartments_path = '../DATA/4_apartments_1000.xlsx'
    
    print("Reading Excel files...")
    df_users = pd.read_excel(users_path)
    df_apartments = pd.read_excel(apartments_path)
    
    with app.app_context():
        print(f"Loaded {len(df_users)} users and {len(df_apartments)} apartments from Excel.")
        
        # 1. Insert Users
        # Ensure we don't duplicate existing ones
        print("Importing users...")
        for _, row in df_users.iterrows():
            email = f"{row['username']}@example.com"
            # check if exists
            user = User.query.filter_by(email=email).first()
            if not user:
                user = User(
                    email=email,
                    password_hash=row['password'],
                    role='landlord'
                )
                db.session.add(user)
        db.session.commit()
        print("Users imported/verified.")
        
        # Build map of landlord_id (from excel) to DB user_id
        # In the script, user_id = landlord_id for landlords. So user_1 is landlord_id 1.
        
        print("Importing properties...")
        added_count = 0
        for _, row in df_apartments.iterrows():
            # Get owner from db
            email = f"user_{row['landlord_id']}@example.com"
            owner = User.query.filter_by(email=email).first()
            if not owner:
                continue # skip if owner not found
            
            # Map tags
            tags = []
            if row['has_parking']: tags.append('חניה')
            if row['has_elevator']: tags.append('מעלית')
            if row['has_mamad']: tags.append('ממ"ד')
            if row['allows_pets']: tags.append('חיות מחמד')
            if row['is_furnished']: tags.append('מרוהטת')
            
            prop = Property(
                owner_id=owner.id,
                title=f"{row['rooms_count']} חדרים ב{row['city']}",
                price_min=row['price'],
                price_max=row['price'] + 500,
                price_label=f"₪{row['price']}/חודש",
                location=row['city'],
                address=row['street'],
                image=row['image_url'],
                tags=",".join(tags),
                rooms=float(row['rooms_count']),
                area=int(row['size_sqm']),
                description=f"דירה יפהפייה בגודל {row['size_sqm']} מ\"ר, מושלמת למגורים."
            )
            db.session.add(prop)
            added_count += 1
            
            if added_count % 100 == 0:
                print(f"Added {added_count} properties...")
                db.session.commit()
                
        db.session.commit()
        print(f"Successfully imported {added_count} properties!")

if __name__ == '__main__':
    run_import()
