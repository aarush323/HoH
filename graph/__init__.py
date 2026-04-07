from langgraph.graph import StateGraph, START, END
from .state import Main_context
from .nodes import (
    analyst_node,
    agent2_compliance,
    intervention_agent,
    queue_for_approval,
    persist_to_db_node,
)


def should_continue(state):
    if state["hard_stop"]:
        return "hard_stop"
    return "continue"


def build_graph():
    """
    NEW APPROVAL FLOW GRAPH:

    START → analyst → agent2_compliance → intervention_agent → queue_for_approval → persist_to_db → END
                                                    ↓
                                              (no voice auto-call)

    Voice calls only happen after human approval via /pending-approvals/{id}/approve
    """
    workflow = StateGraph(Main_context)

    workflow.add_node("analyst", analyst_node)
    workflow.add_node("agent2_compliance", agent2_compliance)
    workflow.add_node("intervention_agent", intervention_agent)
    workflow.add_node("queue_for_approval", queue_for_approval)
    workflow.add_node("persist_to_db", persist_to_db_node)

    workflow.add_edge(START, "analyst")
    workflow.add_edge("analyst", "agent2_compliance")

    # Conditional after compliance: hard_stop goes to persist, else continue
    workflow.add_conditional_edges(
        "agent2_compliance",
        should_continue,
        {"hard_stop": "persist_to_db", "continue": "intervention_agent"},
    )

    # After intervention_agent, queue for approval (no auto voice)
    workflow.add_edge("intervention_agent", "queue_for_approval")
    workflow.add_edge("queue_for_approval", "persist_to_db")
    workflow.add_edge("persist_to_db", END)

    return workflow.compile()
