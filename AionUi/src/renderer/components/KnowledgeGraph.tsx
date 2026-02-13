/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Card, Empty, Typography } from '@arco-design/web-react';

const { Text } = Typography;

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  category: string;
  source_count: number;
  max_sources: number;
};

export type KnowledgeGraphEdge = {
  source: string;
  target: string;
  type?: string;
};

type GraphPoint = {
  x: number;
  y: number;
};

type KnowledgeGraphProps = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  width?: number;
  height?: number;
};

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'];

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ nodes, edges, width = 980, height = 560 }) => {
  const categoryColor = useMemo(() => {
    const map = new Map<string, string>();
    const categories = Array.from(new Set(nodes.map((node) => node.category || 'general')));
    categories.forEach((category, index) => {
      map.set(category, PALETTE[index % PALETTE.length]);
    });
    return map;
  }, [nodes]);

  const positions = useMemo(() => {
    const pointMap = new Map<string, GraphPoint>();
    if (nodes.length === 0) {
      return pointMap;
    }

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.26;

    nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
      const usage = node.max_sources > 0 ? node.source_count / node.max_sources : 0;
      const radiusOffset = usage * 36;
      const radius = baseRadius + radiusOffset;
      pointMap.set(node.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });

    return pointMap;
  }, [height, nodes, width]);

  if (nodes.length === 0) {
    return (
      <Card>
        <Empty description='暂无可视化节点数据' />
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: 'var(--bg-1)', borderRadius: 12 }}>
          {edges.map((edge) => {
            const from = positions.get(edge.source);
            const to = positions.get(edge.target);
            if (!from || !to) {
              return null;
            }
            return <line key={`${edge.source}-${edge.target}-${edge.type || 'rel'}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke='rgba(14, 165, 233, 0.35)' strokeWidth={edge.type === 'hub' ? 2 : 1.2} />;
          })}

          {nodes.map((node) => {
            const point = positions.get(node.id);
            if (!point) {
              return null;
            }
            const color = categoryColor.get(node.category || 'general') || '#0ea5e9';
            const ratio = node.max_sources > 0 ? node.source_count / node.max_sources : 0;
            const radius = 10 + Math.min(Math.max(ratio, 0), 1) * 9;

            return (
              <g key={node.id}>
                <circle cx={point.x} cy={point.y} r={radius + 4} fill='rgba(255,255,255,0.85)' />
                <circle cx={point.x} cy={point.y} r={radius} fill={color} />
                <text x={point.x + radius + 6} y={point.y + 4} fontSize='12' fill='var(--text-primary)'>
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 12 }}>
        <Text type='secondary'>节点大小表示来源占用比例，连线表示同类或高活跃笔记的关联。</Text>
      </div>
    </Card>
  );
};

export default KnowledgeGraph;
