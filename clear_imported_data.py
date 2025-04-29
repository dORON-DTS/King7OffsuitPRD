import sqlite3
import sys

DB_FILE = 'poker.db'
IMPORT_SCRIPT_CREATOR_ID = 'import_script'

def clear_data():
    conn = None # Initialize conn to None
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        print(f"Connected to database '{DB_FILE}'.")

        # Enable foreign key constraints enforcement (good practice)
        cursor.execute("PRAGMA foreign_keys = ON;")

        # Find all table IDs created by the import script
        cursor.execute("SELECT id FROM tables WHERE creatorId = ?", (IMPORT_SCRIPT_CREATOR_ID,))
        table_ids_to_delete = [row[0] for row in cursor.fetchall()]

        if not table_ids_to_delete:
            print("No tables found with creatorId '{IMPORT_SCRIPT_CREATOR_ID}'. No data to clear.")
            return

        print(f"Found {len(table_ids_to_delete)} tables created by the import script. Proceeding with deletion...")

        # Find all player IDs associated with these tables
        placeholders = ',' .join('?' * len(table_ids_to_delete))
        cursor.execute(f"SELECT id FROM players WHERE tableId IN ({placeholders})", table_ids_to_delete)
        player_ids_to_delete = [row[0] for row in cursor.fetchall()]

        deleted_cashouts = 0
        deleted_buyins = 0
        deleted_players = 0
        deleted_tables = 0

        # Start transaction
        conn.execute('BEGIN TRANSACTION')

        try:
            # Delete from child tables first
            if player_ids_to_delete:
                player_placeholders = ',' .join('?' * len(player_ids_to_delete))
                
                # Delete cashouts
                cursor.execute(f"DELETE FROM cashouts WHERE playerId IN ({player_placeholders})", player_ids_to_delete)
                deleted_cashouts = cursor.rowcount
                print(f"  Deleted {deleted_cashouts} cashout records.")

                # Delete buyins
                cursor.execute(f"DELETE FROM buyins WHERE playerId IN ({player_placeholders})", player_ids_to_delete)
                deleted_buyins = cursor.rowcount
                print(f"  Deleted {deleted_buyins} buyin records.")
                
                # Delete players
                cursor.execute(f"DELETE FROM players WHERE id IN ({player_placeholders})", player_ids_to_delete)
                deleted_players = cursor.rowcount
                print(f"  Deleted {deleted_players} player records.")

            # Delete tables
            cursor.execute(f"DELETE FROM tables WHERE id IN ({placeholders})", table_ids_to_delete)
            deleted_tables = cursor.rowcount
            print(f"  Deleted {deleted_tables} table records.")
            
            # Commit transaction
            conn.commit()
            print("\nDeletion successful. Database cleaned.")

        except sqlite3.Error as e:
            # Rollback transaction on error
            print(f"\nAn error occurred: {e}. Rolling back changes.")
            if conn: # Check if conn exists before rollback
                 conn.rollback()
            sys.exit(1) # Exit with error code

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
         print(f"An unexpected error occurred: {e}")
         sys.exit(1)
    finally:
        if conn:
            conn.close()
            print(f"Database connection '{DB_FILE}' closed.")

if __name__ == "__main__":
    print("Starting data clearing process...")
    clear_data()
    print("Script finished.") 