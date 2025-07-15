'use client'

import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Background,
  BackgroundVariant
} from 'reactflow'
import { GameState } from '@settlers/core'
import { useGameStore } from '@/stores/gameStore'
import 'reactflow/dist/style.css'

interface ConnectionLayerProps {
  gameState: GameState
}

export function ConnectionLayer({ }: ConnectionLayerProps) {
  const placementMode = useGameStore(state => state.placementMode)
  const setFlowInstance = useGameStore(state => state.setFlowInstance)
  
  // For now, create empty nodes and edges arrays
  // TODO: Convert game vertices to React Flow nodes
  // TODO: Convert game edges to React Flow edges
  const vertexNodes: Node[] = []
  const roadEdges: Edge[] = []
  
  const [nodes, , onNodesChange] = useNodesState(vertexNodes)
  const [edges, , onEdgesChange] = useEdgesState(roadEdges)
  
  // Handle node clicks (settlement/city placement)
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id)
    // TODO: Implement placement logic
  }
  
  // Handle edge clicks (road placement)
  const handleEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    console.log('Edge clicked:', edge.id)
    // TODO: Implement road placement logic
  }
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onInit={setFlowInstance}
      nodeTypes={{}}
      edgeTypes={{}}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
      minZoom={0.5}
      maxZoom={2}
    >
    </ReactFlow>
  )
} 