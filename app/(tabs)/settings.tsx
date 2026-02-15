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

const AGENT_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  issues_tree: {
    label: "Issues Tree Agent",
    description: "Breaks down objectives into a MECE issues tree",
    icon: "file-tree",
  },
  hypothesis: {
    label: "Hypothesis Agent",
    description: "Generates hypotheses and analysis plans from issues",
    icon: "flask-outline",
  },
  execution: {
    label: "Execution Agent",
    description: "Runs scenario analysis tools on the plan",
    icon: "play-circle-outline",
  },
  summary: {
    label: "Summary Agent",
    description: "Writes executive summary from results",
    icon: "text-box-outline",
  },
};

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
          <View style={styles.infoCard}>
            <Feather name="info" size={16} color={Colors.accent} />
            <Text style={styles.infoText}>
              Edit the system prompts that guide each AI agent. Changes apply to
              all future runs. The default prompts are pre-filled if no custom
              configuration exists.
            </Text>
          </View>

          {configs?.map((config) => {
            const meta = AGENT_LABELS[config.agentType];
            if (!meta) return null;
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
                  <View style={styles.agentIcon}>
                    <MaterialCommunityIcons
                      name={meta.icon as any}
                      size={22}
                      color={Colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.agentLabel}>{meta.label}</Text>
                    <Text style={styles.agentDesc}>{meta.description}</Text>
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
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
