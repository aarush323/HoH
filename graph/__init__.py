from langgraph.graph import StateGraph, START, END
from .state import Main_context
from .nodes import (
    analyst_node,
    agent2_compliance,
    intervention_agent,
    voice_prep_node,
    voice_agent_node,
    persist_to_db_node,
)
from .channel_dispatch import channel_dispatch_node


def should_continue(state):
    if state["hard_stop"]:
        return "hard_stop"
    return "continue"


def build_graph():
    workflow = StateGraph(Main_context)

    workflow.add_node("analyst", analyst_node)
    workflow.add_node("agent2_compliance", agent2_compliance)
    workflow.add_node("intervention_agent", intervention_agent)
    workflow.add_node("voice_prep", voice_prep_node)
    workflow.add_node("channel_dispatch", channel_dispatch_node)
    workflow.add_node("voice_agent", voice_agent_node)
    workflow.add_node("persist_to_db", persist_to_db_node)

    workflow.add_edge(START, "analyst")
    workflow.add_edge("analyst", "agent2_compliance")

    # Conditional after compliance
    workflow.add_conditional_edges(
        "agent2_compliance",
        should_continue,
        {"hard_stop": "persist_to_db", "continue": "intervention_agent"},
    )

    workflow.add_edge("intervention_agent", "voice_prep")
    workflow.add_edge("voice_prep", "channel_dispatch")
    workflow.add_edge("channel_dispatch", "voice_agent")
    workflow.add_edge("voice_agent", "persist_to_db")
    workflow.add_edge("persist_to_db", END)

    return workflow.compile()
