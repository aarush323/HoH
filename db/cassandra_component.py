import os
from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
from dotenv import load_dotenv

load_dotenv()

CASSANDRA_KEYSPACE = os.getenv("CASSANDRA_KEYSPACE", "predelinquency")

profile = ExecutionProfile(
    load_balancing_policy=DCAwareRoundRobinPolicy(local_dc='datacenter1')
)

cluster = Cluster(
    contact_points=["127.0.0.1"],
    port=9042,
    execution_profiles={EXEC_PROFILE_DEFAULT: profile},
    protocol_version=4,
    connect_timeout=30
)

def get_session():
    s = cluster.connect()
    s.set_keyspace(CASSANDRA_KEYSPACE)
    return s

def close():
    cluster.shutdown()

def test_connection():
    try:
        s = get_session()
        rows = s.execute(
            "SELECT table_name FROM system_schema.tables WHERE keyspace_name=%s",
            [CASSANDRA_KEYSPACE]
        )
        tables = [r.table_name for r in rows]
        print(f"Cassandra connected. Tables: {tables}")
    except Exception as e:
        print(f"Cassandra connection failed: {e}")
    finally:
        close()

if __name__ == "__main__":
    test_connection()