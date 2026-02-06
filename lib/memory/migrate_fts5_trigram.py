#!/usr/bin/env python3
"""
Migration script: Rebuild FTS5 indexes with trigram tokenizer
Fixes Issue #9: FTS5 Chinese tokenization optimization
"""

import sqlite3
import sys
from pathlib import Path

def migrate_fts5_trigram(db_path: str):
    """Rebuild FTS5 indexes with trigram tokenizer for better Chinese support"""

    print(f"🔧 Migrating FTS5 indexes in: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Step 1: Drop old FTS5 tables
        print("\n📦 Step 1: Dropping old FTS5 tables...")
        cursor.execute("DROP TABLE IF EXISTS messages_fts;")
        cursor.execute("DROP TABLE IF EXISTS observations_fts;")
        print("   ✅ Old FTS5 tables dropped")

        # Step 2: Recreate messages_fts with trigram tokenizer
        print("\n📦 Step 2: Creating messages_fts with trigram tokenizer...")
        cursor.execute("""
            CREATE VIRTUAL TABLE messages_fts USING fts5(
                content,
                provider,
                skills_used,
                content='messages',
                content_rowid='rowid',
                tokenize='trigram'
            );
        """)
        print("   ✅ messages_fts created with trigram tokenizer")

        # Step 3: Recreate observations_fts with trigram tokenizer
        print("\n📦 Step 3: Creating observations_fts with trigram tokenizer...")
        cursor.execute("""
            CREATE VIRTUAL TABLE observations_fts USING fts5(
                content,
                tags,
                content='observations',
                content_rowid='rowid',
                tokenize='trigram'
            );
        """)
        print("   ✅ observations_fts created with trigram tokenizer")

        # Step 4: Rebuild messages_fts index from existing data
        print("\n📦 Step 4: Rebuilding messages_fts index...")
        cursor.execute("SELECT COUNT(*) FROM messages;")
        message_count = cursor.fetchone()[0]
        print(f"   Found {message_count} messages to index")

        cursor.execute("""
            INSERT INTO messages_fts(rowid, content, provider, skills_used)
            SELECT rowid, content, provider, skills_used FROM messages;
        """)
        print(f"   ✅ Indexed {message_count} messages")

        # Step 5: Rebuild observations_fts index from existing data
        print("\n📦 Step 5: Rebuilding observations_fts index...")
        cursor.execute("SELECT COUNT(*) FROM observations;")
        obs_count = cursor.fetchone()[0]
        print(f"   Found {obs_count} observations to index")

        if obs_count > 0:
            cursor.execute("""
                INSERT INTO observations_fts(rowid, content, tags)
                SELECT rowid, content, tags FROM observations;
            """)
            print(f"   ✅ Indexed {obs_count} observations")
        else:
            print(f"   ⏭️  No observations to index")

        # Step 6: Verify FTS5 search
        print("\n📦 Step 6: Verifying trigram search...")
        cursor.execute("SELECT COUNT(*) FROM messages WHERE content LIKE '%购物车%';")
        like_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '购物车';")
        match_count = cursor.fetchone()[0]

        print(f"   LIKE query:  {like_count} results")
        print(f"   MATCH query: {match_count} results")

        if match_count >= like_count:
            print(f"   ✅ FTS5 search improved! Found {match_count}/{like_count} messages")
        else:
            print(f"   ⚠️  FTS5 still finding {match_count}/{like_count} messages")

        # Commit changes
        conn.commit()
        print("\n✅ Migration completed successfully!")

        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


if __name__ == "__main__":
    # Default database path
    db_path = Path.home() / ".ccb" / "ccb_memory.db"

    # Allow custom path from command line
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])

    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)

    success = migrate_fts5_trigram(str(db_path))
    sys.exit(0 if success else 1)
