import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";

interface AgentField {
  name: string;
  type: string;
  description: string;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

interface AgentDetail {
  key: string;
  label: string;
  role: string;
  roleColor: string;
  roleBg: string;
  stage: string;
  description: string;
  inputs: AgentField[];
  outputs: AgentField[];
  outputSchema: string;
  tools: ToolDef[];
  triggerStage: string;
  producesStage: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon as any} size={16} color={Colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldCard({ field, index }: { field: AgentField; index: number }) {
  return (
    <View style={styles.fieldCard}>
      <View style={styles.fieldNameRow}>
        <Text style={styles.fieldName}>{field.name}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{field.type}</Text>
        </View>
      </View>
      <Text style={styles.fieldDesc}>{field.description}</Text>
    </View>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <View style={styles.codeBlock}>
      {label && <Text style={styles.codeLabel}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <MaterialCommunityIcons
          name="wrench-outline"
          size={16}
          color={Colors.success}
        />
        <Text style={styles.toolName}>{tool.name}</Text>
      </View>
      <Text style={styles.toolDesc}>{tool.description}</Text>
      {Object.keys(tool.parameters).length > 0 && (
        <View style={styles.toolParams}>
          <Text style={styles.toolParamsTitle}>Parameters</Text>
          {Object.entries(tool.parameters).map(([param, desc]) => (
            <View key={param} style={styles.toolParamRow}>
              <Text style={styles.toolParamName}>{param}</Text>
              <Text style={styles.toolParamDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function InfoPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={[styles.infoPillValue, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AgentDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: agent, isLoading, error } = useQuery<AgentDetail>({
    queryKey: ["/api/agents", key],
    enabled: !!key,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (error || !agent) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset }]}>
        <Feather name="alert-circle" size={40} color={Colors.error} />
        <Text style={styles.errorText}>Agent not found</Text>
        <Pressable style={styles.backBtnFallback} onPress={() => router.back()}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <Text style={styles.backBtnFallbackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const promptLines = agent.systemPrompt.split("\n").length;
  const promptPreview =
    agent.systemPrompt.length > 600
      ? agent.systemPrompt.substring(0, 600) + "..."
      : agent.systemPrompt;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "center" }}>
          <MaterialCommunityIcons name="robot-outline" size={18} color={agent.roleColor} />
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {agent.label}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View
            style={[styles.heroAccent, { backgroundColor: agent.roleColor }]}
          />
          <View style={styles.heroBody}>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: agent.roleBg },
                ]}
              >
                <Text
                  style={[styles.roleBadgeText, { color: agent.roleColor }]}
                >
                  {agent.role}
                </Text>
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaLabel}>Stage</Text>
                <Text style={styles.heroMetaValue}>
                  {formatStage(agent.stage)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <MaterialCommunityIcons name="robot-outline" size={26} color={agent.roleColor} />
              <Text style={[styles.heroTitle, { marginBottom: 0 }]}>{agent.label} Agent</Text>
            </View>
            <Text style={styles.heroDesc}>{agent.description}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <InfoPill label="Model" value={agent.model} color={Colors.accent} />
          <InfoPill
            label="Max Tokens"
            value={agent.maxTokens.toLocaleString()}
          />
          <InfoPill
            label="Trigger"
            value={formatStage(agent.triggerStage)}
            color={Colors.success}
          />
          <InfoPill
            label="Produces"
            value={formatStage(agent.producesStage)}
            color={Colors.warning}
          />
        </View>

        <SectionHeader title="Inputs" icon="log-in" />
        {agent.inputs.map((field, i) => (
          <FieldCard key={field.name} field={field} index={i} />
        ))}

        <SectionHeader title="Outputs" icon="log-out" />
        {agent.outputs.map((field, i) => (
          <FieldCard key={field.name} field={field} index={i} />
        ))}

        <SectionHeader title="Output Schema" icon="code" />
        <CodeBlock code={agent.outputSchema} />

        {agent.tools.length > 0 && (
          <>
            <SectionHeader title="Tools" icon="tool" />
            {agent.tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </>
        )}

        <SectionHeader title="System Prompt" icon="terminal" />
        <View style={styles.promptCard}>
          <View style={styles.promptMeta}>
            <Text style={styles.promptMetaText}>
              {promptLines} lines | {agent.systemPrompt.length} chars
            </Text>
          </View>
          <ScrollView
            style={styles.promptScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <Text style={styles.promptText} selectable>
              {agent.systemPrompt}
            </Text>
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 16,
  },
  heroAccent: {
    height: 6,
  },
  heroBody: {
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroMeta: {
    alignItems: "flex-end",
  },
  heroMetaLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  heroMetaValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  infoPill: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    minWidth: 100,
  },
  infoPillLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoPillValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  fieldCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  fieldNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  fieldName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  typeBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  fieldDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  codeBlock: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    marginBottom: 8,
  },
  codeText: {
    fontSize: 12,
    fontFamily: Platform.OS === "web" ? "monospace" : "Courier",
    color: "#E2E8F0",
    lineHeight: 18,
  },
  toolCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    marginBottom: 12,
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  toolName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  toolDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  toolParams: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 12,
  },
  toolParamsTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  toolParamRow: {
    marginBottom: 6,
  },
  toolParamName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  toolParamDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  promptCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
    marginBottom: 16,
  },
  promptMeta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.bg,
  },
  promptMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  promptScroll: {
    maxHeight: 400,
    padding: 14,
  },
  promptText: {
    fontSize: 13,
    fontFamily: Platform.OS === "web" ? "monospace" : "Courier",
    color: Colors.text,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 12,
  },
  backBtnFallback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  backBtnFallbackText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
});
