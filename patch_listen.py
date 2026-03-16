from unittest.mock import patch
import test_agent

with patch('voice_agent.listen.listen', side_effect=['I want to pay normally', 'Thanks']):
    res = test_agent.run_call(test_agent.payload)
    print("FINAL RESULT: ", res)
