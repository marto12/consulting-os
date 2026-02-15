import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Line, Circle, G, ForeignObject, Defs, LinearGradient, Stop, Path } from "react-native-svg";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";

interface AgentDef {
  key: string;
  label: string;
  role: string;
  roleColor: string;
  roleBg: string;
  description: string;
  icon: string;
}

const ALL_AGENTS: AgentDef[] = [
  {
    key: "issues_tree",
    label: "Issues Tree",
    role: "Generator",
    roleColor: "#3B82F6",
    roleBg: "#EFF6FF",
    description: "Breaks down objective into MECE issues tree",
    icon: "robot-outline",
  },
  {
    key: "mece_critic",
    label: "MECE Critic",
    role: "Quality Gate",
    roleColor: "#8B5CF6",
    roleBg: "#F5F3FF",
    description: "Audits issues tree for overlap and gaps",
    icon: "robot-outline",
  },
  {
    key: "hypothesis",
    label: "Hypothesis",
    role: "Analyst",
    roleColor: "#0891B2",
    roleBg: "#ECFEFF",
    description: "Generates testable hypotheses and plans",
    icon: "robot-outline",
  },
  {
    key: "execution",
    label: "Execution",
    role: "Tool Caller",
    roleColor: "#059669",
    roleBg: "#ECFDF5",
    description: "Runs scenario calculator on each plan",
    icon: "robot-outline",
  },
  {
    key: "summary",
    label: "Summary",
    role: "Synthesizer",
    roleColor: "#D97706",
    roleBg: "#FFFBEB",
    description: "Writes executive summary from results",
    icon: "robot-outline",
  },
  {
    key: "presentation",
    label: "Presentation",
    role: "Designer",
    roleColor: "#E11D48",
    roleBg: "#FFF1F2",
    description: "Generates 16:9 slide deck from analysis",
    icon: "robot-outline",
  },
];

interface PipelineConfig {
  id: number;
  name: string;
  agentsJson: string[];
  createdAt: string;
  updatedAt: string;
}

interface GraphNode {
  key: string;
  x: number;
  y: number;
  enabled: boolean;
  agent: AgentDef;
}

function layoutGraphNodes(
  enabledKeys: Set<string>,
  containerWidth: number,
  containerHeight: number
): GraphNode[] {
  const agents = ALL_AGENTS;
  const count = agents.length;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const radiusX = Math.min(containerWidth * 0.35, 240);
  const radiusY = Math.min(containerHeight * 0.32, 180);

  return agents.map((agent, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    return {
      key: agent.key,
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
      enabled: enabledKeys.has(agent.key),
      agent,
    };
  });
}

function AgentNetworkGraph({
  enabledKeys,
  onToggleAgent,
  onSelectAgent,
  selectedAgent,
}: {
  enabledKeys: Set<string>;
  onToggleAgent: (key: string) => void;
  onSelectAgent: (key: string | null) => void;
  selectedAgent: string | null;
}) {
  const screenWidth = Dimensions.get("window").width;
  const graphWidth = Math.min(screenWidth - 40, 700);
  const graphHeight = Math.min(graphWidth * 0.75, 460);
  const nodeRadius = 32;

  const nodes = useMemo(
    () => layoutGraphNodes(enabledKeys, graphWidth, graphHeight),
    [enabledKeys, graphWidth, graphHeight]
  );

  const enabledNodes = nodes.filter((n) => n.enabled);
  const enabledOrder = ALL_AGENTS.filter((a) => enabledKeys.has(a.key));
  const edges: { from: GraphNode; to: GraphNode }[] = [];
  for (let i = 0; i < enabledOrder.length - 1; i++) {
    const fromNode = nodes.find((n) => n.key === enabledOrder[i].key)!;
    const toNode = nodes.find((n) => n.key === enabledOrder[i + 1].key)!;
    edges.push({ from: fromNode, to: toNode });
  }

  function drawArrow(from: GraphNode, to: GraphNode, index: number) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return null;

    const ux = dx / dist;
    const uy = dy / dist;

    const startX = from.x + ux * (nodeRadius + 6);
    const startY = from.y + uy * (nodeRadius + 6);
    const endX = to.x - ux * (nodeRadius + 6);
    const endY = to.y - uy * (nodeRadius + 6);

    const arrowLen = 10;
    const arrowAngle = 0.4;
    const ax1 = endX - arrowLen * Math.cos(Math.atan2(uy, ux) - arrowAngle);
    const ay1 = endY - arrowLen * Math.sin(Math.atan2(uy, ux) - arrowAngle);
    const ax2 = endX - arrowLen * Math.cos(Math.atan2(uy, ux) + arrowAngle);
    const ay2 = endY - arrowLen * Math.sin(Math.atan2(uy, ux) + arrowAngle);

    return (
      <G key={`edge-${index}`}>
        <Line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={Colors.accent}
          strokeWidth={2.5}
          strokeOpacity={0.6}
        />
        <Path
          d={`M ${endX} ${endY} L ${ax1} ${ay1} L ${ax2} ${ay2} Z`}
          fill={Colors.accent}
          fillOpacity={0.6}
        />
      </G>
    );
  }

  return (
    <View style={styles.graphContainer}>
      <Svg width={graphWidth} height={graphHeight}>
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F8FAFC" />
            <Stop offset="1" stopColor="#EFF6FF" />
          </LinearGradient>
        </Defs>

        {edges.map((edge, i) => drawArrow(edge.from, edge.to, i))}

        {nodes.map((node) => {
          const isSelected = selectedAgent === node.key;
          const color = node.enabled ? node.agent.roleColor : Colors.textMuted;
          const fillColor = node.enabled ? node.agent.roleBg : "#F1F5F9";
          const strokeW = isSelected ? 3.5 : node.enabled ? 2.5 : 1.5;

          return (
            <G
              key={node.key}
              onPress={() => onSelectAgent(isSelected ? null : node.key)}
            >
              {isSelected && (
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius + 8}
                  fill={color}
                  opacity={0.1}
                />
              )}
              <Circle
                cx={node.x}
                cy={node.y}
                r={nodeRadius}
                fill={fillColor}
                stroke={color}
                strokeWidth={strokeW}
                strokeDasharray={node.enabled ? undefined : "6,4"}
                opacity={node.enabled ? 1 : 0.5}
              />
              {Platform.OS === "web" && (
                <ForeignObject
                  x={node.x - 14}
                  y={node.y - 14}
                  width={28}
                  height={28}
                >
                  <View style={{ alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
                    <MaterialCommunityIcons
                      name="robot-outline"
                      size={20}
                      color={node.enabled ? color : Colors.textMuted}
                      style={{ opacity: node.enabled ? 1 : 0.4 }}
                    />
                  </View>
                </ForeignObject>
              )}
              {Platform.OS === "web" && (
                <ForeignObject
                  x={node.x - 50}
                  y={node.y + nodeRadius + 6}
                  width={100}
                  height={36}
                >
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={[
                        styles.graphLabel,
                        {
                          color: node.enabled ? Colors.text : Colors.textMuted,
                          fontFamily: isSelected
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {node.agent.label}
                    </Text>
                  </View>
                </ForeignObject>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export default function PipelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(
    new Set(ALL_AGENTS.map((a) => a.key))
  );
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [pipelineName, setPipelineName] = useState("Default Pipeline");
  const [editingName, setEditingName] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const { data: savedPipelines, isLoading: pipelinesLoading } = useQuery<PipelineConfig[]>({
    queryKey: ["/api/pipelines"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const agentsJson = ALL_AGENTS.filter((a) => enabledKeys.has(a.key)).map(
        (a) => a.key
      );
      if (selectedPipelineId) {
        const res = await apiRequest("PUT", `/api/pipelines/${selectedPipelineId}`, {
          name: pipelineName,
          agentsJson,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/pipelines", {
          name: pipelineName,
          agentsJson,
        });
        return res.json();
      }
    },
    onSuccess: (data: PipelineConfig) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      setSelectedPipelineId(data.id);
      if (Platform.OS === "web") {
        window.alert("Pipeline saved");
      } else {
        Alert.alert("Saved", "Pipeline saved successfully");
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to save";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      setSelectedPipelineId(null);
      setPipelineName("Default Pipeline");
      setEnabledKeys(new Set(ALL_AGENTS.map((a) => a.key)));
    },
  });

  const toggleAgent = useCallback(
    (key: string) => {
      setEnabledKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          if (next.size <= 1) return prev;
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    []
  );

  const loadPipeline = useCallback(
    (pipeline: PipelineConfig) => {
      setSelectedPipelineId(pipeline.id);
      setPipelineName(pipeline.name);
      const agents = pipeline.agentsJson as unknown as string[];
      setEnabledKeys(new Set(agents));
      setShowSaved(false);
    },
    []
  );

  const enabledAgents = ALL_AGENTS.filter((a) => enabledKeys.has(a.key));
  const selectedAgentDef = selectedAgent
    ? ALL_AGENTS.find((a) => a.key === selectedAgent)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Pipeline Builder</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => setShowSaved(!showSaved)}
            >
              <Ionicons
                name="folder-open-outline"
                size={18}
                color={Colors.accent}
              />
              <Text style={styles.headerBtnText}>Saved</Text>
            </Pressable>
          </View>
        </View>

        {showSaved && (
          <View style={styles.savedSection}>
            <Text style={styles.savedTitle}>Saved Pipelines</Text>
            {pipelinesLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : !savedPipelines || savedPipelines.length === 0 ? (
              <Text style={styles.savedEmpty}>No saved pipelines yet</Text>
            ) : (
              savedPipelines.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.savedItem,
                    selectedPipelineId === p.id && styles.savedItemActive,
                  ]}
                  onPress={() => loadPipeline(p)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedItemName}>{p.name}</Text>
                    <Text style={styles.savedItemCount}>
                      {(p.agentsJson as unknown as string[]).length} agents
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteMutation.mutate(p.id)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={16} color={Colors.error} />
                  </Pressable>
                </Pressable>
              ))
            )}
          </View>
        )}

        <View style={styles.nameRow}>
          {editingName ? (
            <TextInput
              style={styles.nameInput}
              value={pipelineName}
              onChangeText={setPipelineName}
              onBlur={() => setEditingName(false)}
              onSubmitEditing={() => setEditingName(false)}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <Pressable
              style={styles.nameDisplay}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.nameText}>{pipelineName}</Text>
              <Feather name="edit-2" size={14} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        <AgentNetworkGraph
          enabledKeys={enabledKeys}
          onToggleAgent={toggleAgent}
          onSelectAgent={setSelectedAgent}
          selectedAgent={selectedAgent}
        />

        {selectedAgentDef && (
          <View
            style={[
              styles.detailCard,
              { borderLeftColor: selectedAgentDef.roleColor },
            ]}
          >
            <View style={styles.detailCardHeader}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: selectedAgentDef.roleBg },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: selectedAgentDef.roleColor },
                  ]}
                >
                  {selectedAgentDef.role}
                </Text>
              </View>
              <Text style={styles.detailCardTitle}>
                {selectedAgentDef.label}
              </Text>
            </View>
            <Text style={styles.detailCardDesc}>
              {selectedAgentDef.description}
            </Text>
            <View style={styles.detailCardActions}>
              <Pressable
                style={[
                  styles.toggleBtn,
                  enabledKeys.has(selectedAgentDef.key)
                    ? styles.toggleBtnActive
                    : styles.toggleBtnInactive,
                  { flex: 1 },
                ]}
                onPress={() => toggleAgent(selectedAgentDef.key)}
              >
                <Feather
                  name={
                    enabledKeys.has(selectedAgentDef.key)
                      ? "check-circle"
                      : "plus-circle"
                  }
                  size={16}
                  color={
                    enabledKeys.has(selectedAgentDef.key) ? "#FFFFFF" : Colors.accent
                  }
                />
                <Text
                  style={[
                    styles.toggleBtnText,
                    enabledKeys.has(selectedAgentDef.key)
                      ? styles.toggleBtnTextActive
                      : styles.toggleBtnTextInactive,
                  ]}
                >
                  {enabledKeys.has(selectedAgentDef.key) ? "Enabled" : "Add to Pipeline"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.viewDetailsBtn}
                onPress={() =>
                  router.push(`/agent/${selectedAgentDef.key}`)
                }
              >
                <Feather name="external-link" size={16} color={Colors.accent} />
                <Text style={styles.viewDetailsBtnText}>View Details</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Agent Sequence</Text>
        <Text style={styles.sectionSubtitle}>
          Tap agents in the graph to view details. Toggle them below.
        </Text>

        {ALL_AGENTS.map((agent, index) => {
          const isEnabled = enabledKeys.has(agent.key);
          const sequenceNum = isEnabled
            ? enabledAgents.findIndex((a) => a.key === agent.key) + 1
            : null;

          return (
            <Pressable
              key={agent.key}
              style={[
                styles.agentRow,
                isEnabled && styles.agentRowEnabled,
                selectedAgent === agent.key && {
                  borderColor: agent.roleColor,
                  borderWidth: 2,
                },
              ]}
              onPress={() =>
                setSelectedAgent(
                  selectedAgent === agent.key ? null : agent.key
                )
              }
            >
              <View style={styles.agentRowLeft}>
                {isEnabled ? (
                  <View
                    style={[
                      styles.seqBadge,
                      { backgroundColor: agent.roleColor },
                    ]}
                  >
                    <Text style={styles.seqBadgeText}>{sequenceNum}</Text>
                  </View>
                ) : (
                  <View style={styles.seqBadgeDisabled}>
                    <Feather name="minus" size={14} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.agentRowLabel,
                      !isEnabled && { color: Colors.textMuted },
                    ]}
                  >
                    {agent.label}
                  </Text>
                  <Text style={styles.agentRowRole}>{agent.role}</Text>
                </View>
              </View>
              <View style={styles.agentRowRight}>
                <Pressable
                  onPress={() => router.push(`/agent/${agent.key}`)}
                  hitSlop={8}
                  style={styles.agentRowLink}
                >
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>
              <Pressable
                style={[
                  styles.toggleChip,
                  isEnabled ? styles.toggleChipOn : styles.toggleChipOff,
                ]}
                onPress={() => toggleAgent(agent.key)}
                hitSlop={8}
              >
                <Feather
                  name={isEnabled ? "check" : "plus"}
                  size={14}
                  color={isEnabled ? "#FFFFFF" : Colors.accent}
                />
              </Pressable>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {enabledAgents.length} of {ALL_AGENTS.length} agents active
          </Text>
          <View style={styles.summaryDots}>
            {ALL_AGENTS.map((a) => (
              <View
                key={a.key}
                style={[
                  styles.summaryDot,
                  {
                    backgroundColor: enabledKeys.has(a.key)
                      ? a.roleColor
                      : Colors.surfaceBorder,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 34 + 12 : insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.6 }]}
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.saveBtnText}>
            {selectedPipelineId ? "Update Pipeline" : "Save Pipeline"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  headerBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  savedSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 16,
    gap: 8,
  },
  savedTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  savedEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
  savedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.bg,
  },
  savedItemActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  savedItemName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  savedItemCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  nameRow: {
    marginBottom: 12,
  },
  nameDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  nameInput: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  graphContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
    marginBottom: 16,
    alignItems: "center",
  },
  graphLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  detailCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  detailCardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: Colors.success,
  },
  toggleBtnInactive: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  toggleBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  toggleBtnTextActive: {
    color: "#FFFFFF",
  },
  toggleBtnTextInactive: {
    color: Colors.accent,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  agentRowEnabled: {
    borderColor: Colors.surfaceBorder,
  },
  agentRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  seqBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  seqBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  seqBadgeDisabled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  agentRowLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  agentRowRole: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  toggleChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleChipOn: {
    backgroundColor: Colors.success,
  },
  toggleChipOff: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  detailCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  viewDetailsBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  agentRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  agentRowLink: {
    padding: 4,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginTop: 8,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  summaryDots: {
    flexDirection: "row",
    gap: 6,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
