import pandas as pd
import sqlite3
import uuid
from datetime import datetime
import re
import sys

# Configuration
EXCEL_FILE = 'Copy of Poker 365Scores.xlsx'
DB_FILE = 'poker.db'
DEFAULT_LOCATION = '365 Office, TLV'
DEFAULT_SB = 1
DEFAULT_BB = 1
DEFAULT_CREATOR_ID = 'import_script'

def parse_date_from_sheet_name(sheet_name):
    # Attempt to parse different date formats that might appear in sheet names
    # Example formats: 'DD.MM.YY', 'DD-MM-YY', 'DD/MM/YY', 'DDMMYY', 'Month DD, YYYY', etc.
    # This needs to be robust or make assumptions about the format.
    
    # Try DDMMYY or DDMMYYYY format first
    match_nodot = re.match(r'^(\d{2})(\d{2})(\d{2}|\d{4})$', sheet_name)
    if match_nodot:
        day, month, year = map(int, match_nodot.groups())
        if year < 100: # Handle YY format
            year += 2000 # Assuming years are 20xx
    else:
        # Try formats with separators like DD.MM.YY, DD-MM-YY, DD/MM/YY
        match_dot = re.match(r'^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$', sheet_name)
        if match_dot:
            day, month, year = map(int, match_dot.groups())
            if year < 100: # Handle YY format
                year += 2000 # Assuming years are 20xx
        else:
            # Try format D(D)M(M)YY (e.g., 4424 -> 04/04/24, 28824 -> 28/08/24)
            match_mixed = re.match(r'^(\d{1,2})(\d{1,2})(\d{2})$', sheet_name)
            if match_mixed and len(sheet_name) in [4, 5, 6]: # Basic validation for D(D)M(M)YY length
                d_str, m_str, y_str = match_mixed.groups()
                day = int(d_str)
                month = int(m_str)
                year = int(y_str) + 2000
            else:
                print(f"Warning: Sheet name '{sheet_name}' does not match expected date patterns (DDMMYY, DD.MM.YY, or D(D)M(M)YY). Skipping.")
                return None

    try:
        # Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ) as used in the JS app
        # Use a fixed time (e.g., midday) as Excel doesn't store time in sheet names
        dt = datetime(year, month, day, 12, 0, 0)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ') # Example: 2023-10-26T12:00:00.000Z
    except ValueError:
        print(f"Warning: Could not parse date from sheet name components ({day}, {month}, {year}) in '{sheet_name}'. Skipping.")
        return None

def clean_player_name(name):
    if pd.isna(name):
        return None
    # Remove leading/trailing whitespace and potentially other artifacts
    return str(name).strip()

def get_numeric_value(value):
    if pd.isna(value):
        return 0
    try:
        # Remove currency symbols, commas, etc., and convert to number
        cleaned_value = re.sub(r'[^\d.]', '', str(value))
        return int(float(cleaned_value)) # Convert to float first for decimals, then int
    except (ValueError, TypeError):
        return 0

def import_data():
    try:
        xls = pd.ExcelFile(EXCEL_FILE)
    except FileNotFoundError:
        print(f"Error: Excel file '{EXCEL_FILE}' not found.")
        sys.exit(1)

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    print(f"Connected to database '{DB_FILE}'.")

    total_tables_imported = 0
    total_players_imported = 0

    for sheet_name in xls.sheet_names:
        print(f"\\nProcessing sheet: '{sheet_name}'")
        table_date_iso = parse_date_from_sheet_name(sheet_name)
        if not table_date_iso:
            continue # Skip sheet if date parsing failed

        # Create a unique ID for the table
        table_id = str(uuid.uuid4())
        table_name = f"Game_{sheet_name}" # Use sheet name for the table name

        # Check if table with this name already exists
        cursor.execute("SELECT id FROM tables WHERE name = ?", (table_name,))
        existing_table = cursor.fetchone()

        if existing_table:
            print(f"  Table '{table_name}' already exists (ID: {existing_table[0]}). Skipping sheet.")
            continue # Skip this sheet entirely if table name exists

        # If table does not exist, proceed with insertion
        try:
            # Insert the table record
            cursor.execute('''
                INSERT INTO tables (id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (table_id, table_name, DEFAULT_SB, DEFAULT_BB, DEFAULT_LOCATION, 0, table_date_iso, DEFAULT_CREATOR_ID))
            print(f"  Inserted table '{table_name}' (ID: {table_id})")
            total_tables_imported += 1
        except sqlite3.IntegrityError as e:
             # This error should theoretically not happen now for name conflicts, but good to keep for other potential issues
             print(f"  Error inserting table '{table_name}': {e}. Skipping.")
             continue # Skip this sheet if table insertion fails

        # Read the sheet data, assuming data starts from row 2 (index 1)
        # and columns are at fixed positions. No header row needed.
        try:
            df = xls.parse(sheet_name, header=None, skiprows=1)

            # Define column indices based on user's description
            COL_IDX_PLAYER_NAME = 0
            COL_IDX_SHOW_ME = 1
            COL_IDX_TOTAL_BUYIN = 9  # Column J
            COL_IDX_TOTAL_STAKE = 10 # Column K

            # Check if the dataframe has enough columns
            if df.shape[1] <= max(COL_IDX_PLAYER_NAME, COL_IDX_SHOW_ME, COL_IDX_TOTAL_BUYIN, COL_IDX_TOTAL_STAKE):
                print(f"  Warning: Sheet '{sheet_name}' does not have the expected number of columns (at least {max(COL_IDX_PLAYER_NAME, COL_IDX_SHOW_ME, COL_IDX_TOTAL_BUYIN, COL_IDX_TOTAL_STAKE) + 1}). Skipping sheet.")
                continue

        except Exception as e:
            print(f"  Error reading or processing sheet '{sheet_name}': {e}. Skipping.")
            continue

        players_in_sheet = 0
        for index, row in df.iterrows():
            # Access data by column index
            player_name = clean_player_name(row.iloc[COL_IDX_PLAYER_NAME])
            show_me_val = row.iloc[COL_IDX_SHOW_ME]
            buy_in = get_numeric_value(row.iloc[COL_IDX_TOTAL_BUYIN])
            cash_out = get_numeric_value(row.iloc[COL_IDX_TOTAL_STAKE])

            # Skip rows with no player name or specific names like "Palyer"
            if not player_name or player_name.lower() == 'palyer':
                # print(f" Skipping row {index + 2}: No player name or is 'Palyer'.") # +2 because skiprows=1 and 0-based index
                continue

            # Determine the value for the database 'showMe' field based on Excel's ShowMe column
            # REVERSED LOGIC: Default to 1 (TRUE) and set to 0 (FALSE) if Excel indicates TRUE ('X', 1, etc.)
            db_show_me_value = 1 # Default to TRUE
            if not pd.isna(show_me_val):
                # If Excel has a value indicating TRUE, set DB value to FALSE (0)
                if isinstance(show_me_val, str) and show_me_val.strip().upper() in ['X', 'TRUE', 'T', 'YES', 'Y', '1']:
                    db_show_me_value = 0 # Set to FALSE in DB
                elif isinstance(show_me_val, (int, float)) and show_me_val != 0:
                    db_show_me_value = 0 # Set to FALSE in DB
            
            player_id = str(uuid.uuid4())
            buyin_id = str(uuid.uuid4())
            cashout_id = str(uuid.uuid4())

            # Use table date for buy-in and cash-out timestamps
            # Add a small delay to cashout time for logical order if needed
            buyin_timestamp = table_date_iso
            # Example: add 1 hour to cashout timestamp
            try:
                 cashout_dt = datetime.strptime(table_date_iso, '%Y-%m-%dT%H:%M:%S.%fZ')
                 cashout_dt += pd.Timedelta(hours=1)
                 cashout_timestamp = cashout_dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            except ValueError:
                 cashout_timestamp = table_date_iso # Fallback if parsing fails

            try:
                # Insert player
                cursor.execute('''
                    INSERT INTO players (id, tableId, name, nickname, chips, totalBuyIn, active, showMe)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (player_id, table_id, player_name, player_name, 0, buy_in, 0, db_show_me_value)) # Use interpreted db_show_me_value

                # Insert buy-in
                cursor.execute('''
                    INSERT INTO buyins (id, playerId, amount, timestamp)
                    VALUES (?, ?, ?, ?)
                ''', (buyin_id, player_id, buy_in, buyin_timestamp))

                # Insert cash-out only if amount > 0 (optional, depends on logic)
                if cash_out > 0:
                    cursor.execute('''
                        INSERT INTO cashouts (id, playerId, amount, timestamp)
                        VALUES (?, ?, ?, ?)
                    ''', (cashout_id, player_id, cash_out, cashout_timestamp))
                
                # print(f"    Added Player: {player_name}, BuyIn: {buy_in}, CashOut: {cash_out}") # Debugging
                players_in_sheet += 1

            except sqlite3.Error as e:
                print(f"    Error inserting data for player '{player_name}' in table '{table_name}': {e}")
                # Consider rolling back transaction for the sheet if needed

        if players_in_sheet > 0:
            print(f"  Successfully imported {players_in_sheet} players for table '{table_name}'.")
            total_players_imported += players_in_sheet
        else:
             print(f"  No valid player data found or imported for table '{table_name}'.")


    conn.commit()
    conn.close()
    print(f"\\nImport finished. Imported {total_tables_imported} tables and {total_players_imported} players.")
    print(f"Database '{DB_FILE}' updated.")

if __name__ == "__main__":
    print("Starting Excel to DB import process...")
    import_data()
    print("Script finished.") 