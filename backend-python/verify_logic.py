import sqlite3
import os
import json

# Path to database
db_path = os.path.join(os.path.dirname(__file__), '..', 'backend-node', 'biomixer.db')
output_file = os.path.join(os.path.dirname(__file__), 'py_verify_result.txt')

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(f"Checking DB at: {db_path}\n")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check count
        cursor.execute("SELECT COUNT(*) FROM alarm_events")
        count = cursor.fetchone()[0]
        f.write(f"Total events in DB: {count}\n")
        
        # Check distribution
        cursor.execute("SELECT mixing_pattern, COUNT(*) FROM alarm_events GROUP BY mixing_pattern")
        rows = cursor.fetchall()
        f.write("Distribution:\n")
        for row in rows:
            f.write(f"  {row[0]}: {row[1]}\n")
            
        conn.close()
        f.write("\nDB Check Complete.\n")
        
    except Exception as e:
        f.write(f"Error: {e}\n")
