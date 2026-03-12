from langgraph.graph import StateGraph, START, END
from .state import Main_context
from .nodes import analyst_node, agent2_compliance, intervention_agent



def build_graph():
    workflow = StateGraph(Main_context)

    workflow.add_node("analyst", analyst_node)
    workflow.add_node("agent2_compliance", agent2_compliance)
    workflow.add_node("intervention_agent", intervention_agent)


    workflow.add_edge(START, "analyst")
    workflow.add_edge("analyst", "agent2_compliance")
    workflow.add_edge("agent2_compliance", "intervention_agent")
    workflow.add_edge("intervention_agent", END)

    return workflow.compile()