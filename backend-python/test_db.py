import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'test_biomixer.db')
output_file = os.path.join(os.path.dirname(__file__), 'python_test_result.txt')

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, val TEXT)")
    cursor.execute("INSERT INTO test (val) VALUES ('Hello')")
    conn.commit()
    conn.close()
    
    with open(output_file, 'w') as f:
        f.write("DB Write Success")
except Exception as e:
    with open(output_file, 'w') as f:
        f.write(f"DB Write Failed: {e}")
