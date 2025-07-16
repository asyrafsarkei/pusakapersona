
import sqlite3

db_path = r'C:\Users\asyraf.sarkei\gemini-ai\my-web-app\server\database.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, username, email, isAdmin, isApproved FROM users;")
    
    rows = cursor.fetchall()
    column_names = [description[0] for description in cursor.description]

    if rows:
        print("|" + "|".join(column_names) + "|")
        print("|" + "-" * (sum(len(col) for col in column_names) + len(column_names) - 1) + "|")
        for row in rows:
            print("|" + "|".join(str(item) for item in row) + "|")
    else:
        print("No users found in the database.")

except sqlite3.Error as e:
    print(f"SQLite error: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
finally:
    if conn:
        conn.close()
