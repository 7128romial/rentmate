import pandas as pd
import random

# הגדרת ערים ומאפיינים מגוונים לפי אופי העיר
CITIES = ['Tel Aviv', 'Jerusalem', 'Haifa', 'Beer Sheva']
STREETS = {
    'Tel Aviv': ['Dizengoff', 'Ibn Gabirol', 'Rothschild', 'King George', 'Ben Yehuda'],
    'Jerusalem': ['Jaffa', 'Agripas', 'King George', 'Gaza', 'Emek Refaim'],
    'Haifa': ['Hanassi', 'Horev', 'Ben Gurion', 'Arlozorov', 'Moriah'],
    'Beer Sheva': ['Rager', 'Bialik', 'Avraham Avinu', 'Mesada', 'Shimoni']
}

# 1. טבלת אדם (Users) - רק נתוני התחברות בסיסיים, ללא תפקיד (role)
users_data = []
for i in range(1, 1001):
    users_data.append({
        'user_id': i,
        'username': f'user_{i}',
        'password': f'hashed_password_xyz_{i}'
    })
df_users = pd.DataFrame(users_data)

# 2. טבלת בעל דירה (Landlords) - מקושרת לאדם (נניח שחצי מהאנשים הם בעלי דירות)
landlords_data = []
for i in range(1, 501):  # 500 בעלי דירה
    landlords_data.append({
        'landlord_id': i,
        'user_id': i  # קישור ישיר לטבלת אדם
    })
df_landlords = pd.DataFrame(landlords_data)

# 3. טבלת מחפש דירה (Seekers) - מקושרת לאדם (החצי השני של האנשים) ומכילה נתוני הצלבה
seekers_data = []
seeker_id = 1
for user_id in range(501, 1001):  # 500 מחפשי דירה ייחודיים
    city = random.choice(CITIES)
    min_r = random.randint(1, 3)
    max_r = min_r + random.randint(0, 2)

    seekers_data.append({
        'seeker_id': seeker_id,
        'user_id': user_id,  # קישור ישיר לטבלת אדם
        'preferred_city': city,
        'min_rooms': min_r,
        'max_rooms': max_r,
        'requires_elevator': random.choice([True, False]),
        'requires_parking': random.choice([True, False]),
        'requires_mamad': random.choice([True, False]),
        'is_roommate_flat': random.choice([True, False]),
        'allows_pets': random.choice([True, False]),
        'allows_smoking': random.choice([True, False]),
        'max_budget': random.randint(4000, 9000) if city in ['Tel Aviv', 'Jerusalem'] else random.randint(1800, 4500)
    })
    seeker_id += 1

# השלמה ל-1,000 רשומות בטבלת מחפשים (באמצעות פילוח העדפות מגוון נוסף)
for i in range(501, 1001):
    city = random.choice(CITIES)
    min_r = random.randint(1, 3)
    max_r = min_r + random.randint(0, 2)
    seekers_data.append({
        'seeker_id': i,
        'user_id': random.randint(501, 1000),  # קישורים חוזרים מגוונים
        'preferred_city': city,
        'min_rooms': min_r,
        'max_rooms': max_r,
        'requires_elevator': random.choice([True, False]),
        'requires_parking': random.choice([True, False]),
        'requires_mamad': random.choice([True, False]),
        'is_roommate_flat': random.choice([True, False]),
        'allows_pets': random.choice([True, False]),
        'allows_smoking': random.choice([True, False]),
        'max_budget': random.randint(4000, 9000) if city in ['Tel Aviv', 'Jerusalem'] else random.randint(1800, 4500)
    })
df_seekers = pd.DataFrame(seekers_data)

# 4. טבלת דירה (Apartments) - מקושרת לטבלת בעל דירה (landlord_id)
apartments_data = []
landlord_ids_list = df_landlords['landlord_id'].tolist()

for i in range(1, 1001):
    city = random.choice(CITIES)
    rooms = random.randint(1, 5)

    apartments_data.append({
        'apartment_id': i,
        'landlord_id': random.choice(landlord_ids_list),  # מקושרת לטבלת בעל דירה!
        'city': city,
        'street': f'{random.choice(STREETS[city])} {random.randint(1, 150)}',
        'price': random.randint(4500, 9500) if city in ['Tel Aviv', 'Jerusalem'] else random.randint(2000, 4800),
        'has_parking': random.choice([True, False]),
        'has_elevator': random.choice([True, False]),
        'has_mamad': random.choice([True, False]),
        'is_roommate_flat': random.choice([True, False]),
        'allows_pets': random.choice([True, False]),
        'allows_smoking': random.choice([True, False]),
        'is_furnished': random.choice([True, False]),
        'rooms_count': rooms,
        'size_sqm': rooms * random.randint(20, 30),
        'image_url': f'https://picsum.photos/640/480?random={i}'
    })
df_apartments = pd.DataFrame(apartments_data)

# שמירה ל-4 קבצי אקסל נפרדים ומדויקים למבנה הירושה
df_users.to_excel('1_users_1000.xlsx', index=False)
df_landlords.to_excel('2_landlords_1000.xlsx', index=False)
df_seekers.to_excel('3_seekers_1000.xlsx', index=False)
df_apartments.to_excel('4_apartments_1000.xlsx', index=False)

print("כל 4 קבצי האקסל עם 1,000 שורות במבנה הקשרים החדש נוצרו בהצלחה!")