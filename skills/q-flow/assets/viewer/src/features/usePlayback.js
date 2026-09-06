import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasArrow } from '../diagrams/registry.js';
import { playbackPlan } from '../playback.js';

export function usePlayback(graph, reduceMotion) {
  const plan = useMemo(() => playbackPlan(graph), [graph]);
  const playbackCount = plan.steps.length;
  const hasPlayback = playbackCount > 0;
  const hasFlow = graph.edges.some(edge => hasArrow(edge, graph.meta.diagramType));
  const [cursor, setCursor] = useState({ index: 0, pulse: 0 });
  const playbackStep = cursor.index;
  const [playing, setPlaying] = useState(() => playbackCount > 1 && !reduceMotion);
  const [flowEnabled, setFlowEnabled] = useState(true);
  const flowRunning = flowEnabled && !reduceMotion;
  const timerRef = useRef(null);
  const pausePlayback = useCallback(() => { window.clearTimeout(timerRef.current); setPlaying(false); }, []);
  useEffect(() => { if (reduceMotion) pausePlayback(); }, [pausePlayback, reduceMotion]);
  useEffect(() => {
    if (!playing || playbackCount < 2) return undefined;
    const timer = window.setTimeout(() => setCursor(value => ({ index: (value.index + 1) % playbackCount, pulse: value.pulse + 1 })), 1800);
    timerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [playbackCount, cursor, playing]);
  const current = plan.steps[playbackStep];
  const playbackEdge = graph.edges.find(edge => edge.id === current?.edgeId);
  const completedEdgeIds = useMemo(() => new Set(plan.steps.slice(0, playbackStep).map(step => step.edgeId).filter(Boolean)), [plan, playbackStep]);
  const completedNodeIds = useMemo(() => new Set([
    ...plan.steps.slice(0, playbackStep).map(step => step.nodeId),
    ...graph.edges.filter(edge => completedEdgeIds.has(edge.id)).flatMap(edge => [edge.source, edge.target])
  ]), [plan, playbackStep, completedEdgeIds, graph.edges]);
  const stepPlayback = delta => { pausePlayback(); if (hasPlayback) setCursor(value => ({ index: (value.index + delta + playbackCount) % playbackCount, pulse: value.pulse + 1 })); };
  const resetPlayback = () => { window.clearTimeout(timerRef.current); setCursor(value => ({ index: 0, pulse: value.pulse + 1 })); setPlaying(playbackCount > 1 && !reduceMotion); setFlowEnabled(true); };
  const from = graph.nodes.find(node => node.id === playbackEdge?.source)?.label ?? playbackEdge?.source;
  const to = graph.nodes.find(node => node.id === playbackEdge?.target)?.label ?? playbackEdge?.target;
  const flowCopy = playbackEdge ? `${from} → ${to}${playbackEdge.label ? ` · ${playbackEdge.label}` : ''}` : graph.nodes.find(node => node.id === current?.nodeId)?.label ?? '';
  const flowStatus = hasPlayback ? `${playing ? '演示中' : '演示已暂停'} ${playbackStep + 1}/${playbackCount}` : '暂无可演示节点';
  return { hasPlayback, hasFlow, playbackStep, playbackCount, playbackMode: plan.mode, playbackDescription: plan.description, playbackNodeId: current?.nodeId, playbackPulse: cursor.pulse, playing, setPlaying, pausePlayback, stepPlayback, resetPlayback, playbackEdge, completedEdgeIds, completedNodeIds, flowCopy, flowStatus, flowRunning, setFlowEnabled };
}
