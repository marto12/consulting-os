import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";

const PIPELINE_STEPS = [
  {
    key: "issues_tree",
    step: 1,
    label: "Issues Tree",
    role: "Generator",
    roleColor: "#3B82F6",
    roleBg: "#EFF6FF",
    description: "Breaks down the objective into a structured MECE issues tree",
    icon: "robot-outline",
    detail: "Takes the project objective and constraints, produces a hierarchical tree of issues to investigate.",
  },
  {
    key: "mece_critic",
    step: 2,
    label: "MECE Critic",
    role: "Quality Gate",
    roleColor: "#8B5CF6",
    roleBg: "#F5F3FF",
    description: "Audits the issues tree for overlap, gaps, and quality",
    icon: "robot-outline",
    detail: "Scores the tree on 5 criteria (overlap, coverage, logic, balance, labels). Can send it back for up to 2 revisions.",
  },
  {
    key: "hypothesis",
    step: 3,
    label: "Hypothesis",
    role: "Analyst",
    roleColor: "#0891B2",
    roleBg: "#ECFEFF",
    description: "Generates testable hypotheses and analysis plans",
    icon: "robot-outline",
    detail: "Reads the approved issues tree and generates hypotheses with specific metrics, data sources, and methods.",
  },
  {
    key: "execution",
    step: 4,
    label: "Execution",
    role: "Tool Caller",
    roleColor: "#059669",
    roleBg: "#ECFDF5",
    description: "Runs the scenario calculator on each analysis plan",
    icon: "robot-outline",
    detail: "Calls the scenario calculator tool with financial parameters to produce baseline, optimistic, and pessimistic projections.",
  },
  {
    key: "summary",
    step: 5,
    label: "Summary",
    role: "Synthesizer",
    roleColor: "#D97706",
    roleBg: "#FFFBEB",
    description: "Writes the executive summary from all results",
    icon: "robot-outline",
    detail: "Produces a polished executive summary with key findings, recommendation, and next steps.",
  },
  {
    key: "presentation",
    step: 6,
    label: "Presentation",
    role: "Designer",
    roleColor: "#E11D48",
    roleBg: "#FFF1F2",
    description: "Generates a 16:9 slide deck from the analysis",
    icon: "robot-outline",
    detail: "Creates 6-10 structured slides with 5 layout types: title, section header, bullet points, two-column comparison, and metrics dashboard.",
  },
];

const AGENT_LABELS: Record<string, { label: string; description: string; icon: string }> = {};
PIPELINE_STEPS.forEach((s) => {
  AGENT_LABELS[s.key] = { label: s.label, description: s.description, icon: s.icon };
});

interface AgentConfig {
  id: number;
  agentType: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  updatedAt: string;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});
  const [editModels, setEditModels] = useState<Record<string, string>>({});
  const [editMaxTokens, setEditMaxTokens] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  const { data: configs, isLoading } = useQuery<AgentConfig[]>({
    queryKey: ["/api/agent-configs"],
  });

  useEffect(() => {
    if (configs) {
      const prompts: Record<string, string> = {};
      const models: Record<string, string> = {};
      const tokens: Record<string, string> = {};
      configs.forEach((c) => {
        prompts[c.agentType] = c.systemPrompt;
        models[c.agentType] = c.model;
        tokens[c.agentType] = String(c.maxTokens);
      });
      setEditPrompts(prompts);
      setEditModels(models);
      setEditMaxTokens(tokens);
      setHasChanges({});
    }
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async (agentType: string) => {
      const res = await apiRequest("PUT", `/api/agent-configs/${agentType}`, {
        systemPrompt: editPrompts[agentType],
        model: editModels[agentType],
        maxTokens: parseInt(editMaxTokens[agentType]) || 8192,
      });
      return res.json();
    },
    onSuccess: (_data, agentType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-configs"] });
      setHasChanges((prev) => ({ ...prev, [agentType]: false }));
      if (Platform.OS === "web") {
        window.alert("Configuration saved successfully");
      } else {
        Alert.alert("Saved", "Configuration saved successfully");
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to save";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const handlePromptChange = (agentType: string, value: string) => {
    setEditPrompts((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const handleModelChange = (agentType: string, value: string) => {
    setEditModels((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const handleMaxTokensChange = (agentType: string, value: string) => {
    setEditMaxTokens((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const toggleExpand = (agentType: string) => {
    setExpandedAgent(expandedAgent === agentType ? null : agentType);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Configure agents, prompts, and parameters
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pipelineSection}>
            <Text style={styles.pipelineSectionTitle}>Agent Pipeline</Text>
            <Text style={styles.pipelineSectionSubtitle}>
              Each project runs through these stages in order. Human approval is required between stages.
            </Text>
            <View style={styles.pipelineTrack}>
              {PIPELINE_STEPS.map((step, idx) => (
                <View key={step.key}>
                  <View style={styles.pipelineStep}>
                    <View style={styles.pipelineStepLeft}>
                      <View style={[styles.pipelineStepDot, { backgroundColor: step.roleColor }]}>
                        <Text style={styles.pipelineStepNum}>{step.step}</Text>
                      </View>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <View style={styles.pipelineConnector}>
                          {step.key === "issues_tree" && (
                            <View style={styles.pipelineLoopIndicator}>
                              <Ionicons name="repeat" size={11} color="#8B5CF6" />
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={styles.pipelineStepContent}>
                      <View style={styles.pipelineStepHeader}>
                        <MaterialCommunityIcons
                          name={step.icon as any}
                          size={16}
                          color={step.roleColor}
                        />
                        <Text style={styles.pipelineStepLabel}>{step.label}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: step.roleBg }]}>
                          <Text style={[styles.roleBadgeText, { color: step.roleColor }]}>{step.role}</Text>
                        </View>
                      </View>
                      <Text style={styles.pipelineStepDetail}>{step.detail}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.configSectionTitle}>Agent Configuration</Text>

          {[...(configs || [])].sort((a, b) => {
            const ai = PIPELINE_STEPS.findIndex((s) => s.key === a.agentType);
            const bi = PIPELINE_STEPS.findIndex((s) => s.key === b.agentType);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          }).map((config) => {
            const pipelineStep = PIPELINE_STEPS.find((s) => s.key === config.agentType);
            if (!pipelineStep) return null;
            const isExpanded = expandedAgent === config.agentType;
            const changed = hasChanges[config.agentType];
            const isSaving = saveMutation.isPending;

            return (
              <View key={config.agentType} style={styles.agentCard}>
                <Pressable
                  style={styles.agentHeader}
                  onPress={() => toggleExpand(config.agentType)}
                  testID={`agent-card-${config.agentType}`}
                >
                  <View style={[styles.agentIcon, { backgroundColor: pipelineStep.roleBg }]}>
                    <MaterialCommunityIcons
                      name={pipelineStep.icon as any}
                      size={22}
                      color={pipelineStep.roleColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.agentLabelRow}>
                      <Text style={styles.agentLabel}>{pipelineStep.label}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: pipelineStep.roleBg }]}>
                        <Text style={[styles.roleBadgeText, { color: pipelineStep.roleColor }]}>
                          Step {pipelineStep.step} · {pipelineStep.role}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.agentDesc}>{pipelineStep.description}</Text>
                  </View>
                  <View style={styles.headerRight}>
                    {changed && (
                      <View style={styles.unsavedBadge}>
                        <Text style={styles.unsavedText}>Unsaved</Text>
                      </View>
                    )}
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.agentBody}>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Model</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={editModels[config.agentType] || ""}
                          onChangeText={(v) =>
                            handleModelChange(config.agentType, v)
                          }
                          placeholder="gpt-5-nano"
                          placeholderTextColor={Colors.textMuted}
                          testID={`model-input-${config.agentType}`}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Max Tokens</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={editMaxTokens[config.agentType] || ""}
                          onChangeText={(v) =>
                            handleMaxTokensChange(config.agentType, v)
                          }
                          keyboardType="numeric"
                          placeholder="8192"
                          placeholderTextColor={Colors.textMuted}
                          testID={`tokens-input-${config.agentType}`}
                        />
                      </View>
                    </View>

                    <Text style={styles.fieldLabel}>System Prompt</Text>
                    <TextInput
                      style={styles.promptInput}
                      value={editPrompts[config.agentType] || ""}
                      onChangeText={(v) =>
                        handlePromptChange(config.agentType, v)
                      }
                      multiline
                      numberOfLines={12}
                      textAlignVertical="top"
                      placeholder="Enter system prompt..."
                      placeholderTextColor={Colors.textMuted}
                      testID={`prompt-input-${config.agentType}`}
                    />

                    <View style={styles.actionRow}>
                      <Text style={styles.lastUpdated}>
                        {config.id > 0
                          ? `Last updated: ${new Date(config.updatedAt).toLocaleDateString()}`
                          : "Using default prompt"}
                      </Text>
                      <Pressable
                        style={({ pressed }) => [
                          styles.saveButton,
                          !changed && styles.saveButtonDisabled,
                          pressed && changed && { opacity: 0.8 },
                        ]}
                        onPress={() => saveMutation.mutate(config.agentType)}
                        disabled={!changed || isSaving}
                        testID={`save-btn-${config.agentType}`}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Feather name="save" size={16} color="#FFF" />
                            <Text style={styles.saveButtonText}>Save</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: Platform.OS === "web" ? 34 : 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  pipelineSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    marginBottom: 4,
  },
  pipelineSectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  pipelineSectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 18,
  },
  pipelineTrack: {
    gap: 0,
  },
  pipelineStep: {
    flexDirection: "row" as const,
    gap: 14,
  },
  pipelineStepLeft: {
    alignItems: "center" as const,
    width: 28,
  },
  pipelineStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  pipelineStepNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  pipelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.surfaceBorder,
    alignSelf: "center" as const,
    minHeight: 24,
    position: "relative" as const,
  },
  pipelineLoopIndicator: {
    position: "absolute" as const,
    left: -8,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F5F3FF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  pipelineStepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  pipelineStepHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 4,
  },
  pipelineStepLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  pipelineStepDetail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  configSectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: -4,
  },
  agentLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    flexWrap: "wrap" as const,
  },
  agentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
  },
  agentHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  agentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  agentLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  agentDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unsavedBadge: {
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unsavedText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.warning,
  },
  agentBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    padding: 16,
    gap: 12,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  promptInput: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 200,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastUpdated: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});
