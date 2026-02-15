import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";

const STAGE_LABELS: Record<string, string> = {
  created: "New",
  issues_draft: "Issues Draft",
  issues_approved: "Issues Approved",
  hypotheses_draft: "Hypotheses Draft",
  hypotheses_approved: "Hypotheses Approved",
  execution_done: "Execution Done",
  execution_approved: "Execution Approved",
  summary_draft: "Summary Draft",
  summary_approved: "Summary Approved",
  complete: "Complete",
};

const WORKFLOW_STEPS = [
  { key: "issues", label: "Issues Tree", stages: ["issues_draft", "issues_approved"] },
  { key: "hypotheses", label: "Hypotheses", stages: ["hypotheses_draft", "hypotheses_approved"] },
  { key: "execution", label: "Execution", stages: ["execution_done", "execution_approved"] },
  { key: "summary", label: "Summary", stages: ["summary_draft", "complete"] },
];

const TABS = ["overview", "issues", "hypotheses", "runs", "summary", "logs"] as const;
type TabKey = (typeof TABS)[number];

const TAB_CONFIG: Record<TabKey, { label: string; icon: string }> = {
  overview: { label: "Overview", icon: "layers-outline" },
  issues: { label: "Issues", icon: "git-branch-outline" },
  hypotheses: { label: "Hypotheses", icon: "flask-outline" },
  runs: { label: "Runs", icon: "bar-chart-outline" },
  summary: { label: "Summary", icon: "document-text-outline" },
  logs: { label: "Logs", icon: "terminal-outline" },
};

function getStepStatus(
  step: (typeof WORKFLOW_STEPS)[number],
  currentStage: string
): "pending" | "active" | "approved" | "complete" {
  const stageOrder = [
    "created",
    "issues_draft",
    "issues_approved",
    "hypotheses_draft",
    "hypotheses_approved",
    "execution_done",
    "execution_approved",
    "summary_draft",
    "complete",
  ];
  const currentIdx = stageOrder.indexOf(currentStage);
  const stepStartIdx = stageOrder.indexOf(step.stages[0]);
  const stepEndIdx = stageOrder.indexOf(step.stages[step.stages.length - 1]);

  if (currentIdx > stepEndIdx) return "complete";
  if (currentIdx >= stepStartIdx && currentIdx <= stepEndIdx) return "active";
  return "pending";
}

function canRunNext(stage: string): boolean {
  return ["created", "issues_approved", "hypotheses_approved", "execution_approved"].includes(stage);
}

function canApprove(stage: string): boolean {
  return ["issues_draft", "hypotheses_draft", "execution_done", "summary_draft"].includes(stage);
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [refreshing, setRefreshing] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ["/api/projects", id],
    refetchInterval: 3000,
  });

  const { data: artifacts } = useQuery<any>({
    queryKey: ["/api/projects", id, "artifacts"],
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "logs"],
    refetchInterval: 5000,
  });

  const runNextMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/run-next`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "logs"],
      });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "artifacts"],
      });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] }),
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "artifacts"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "logs"],
      }),
    ]);
    setRefreshing(false);
  }, [id]);

  if (projectLoading || !project) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  const stage = project.stage;
  const showRunNext = canRunNext(stage);
  const showApprove = canApprove(stage);
  const isComplete = stage === "complete";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {project.name}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={TAB_CONFIG[tab].icon as any}
                size={16}
                color={activeTab === tab ? Colors.accent : Colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {TAB_CONFIG[tab].label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            stage={stage}
          />
        )}
        {activeTab === "issues" && (
          <IssuesTab issues={artifacts?.issueNodes || []} />
        )}
        {activeTab === "hypotheses" && (
          <HypothesesTab
            hypotheses={artifacts?.hypotheses || []}
            plans={artifacts?.analysisPlan || []}
          />
        )}
        {activeTab === "runs" && (
          <RunsTab runs={artifacts?.modelRuns || []} />
        )}
        {activeTab === "summary" && (
          <SummaryTab narratives={artifacts?.narratives || []} />
        )}
        {activeTab === "logs" && <LogsTab logs={logs || []} />}
      </ScrollView>

      {(showRunNext || showApprove) && !isComplete && (
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom:
                Platform.OS === "web" ? 34 + 16 : insets.bottom + 16,
            },
          ]}
        >
          {showApprove && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.approveButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.actionText}>Approve</Text>
                </>
              )}
            </Pressable>
          )}
          {showRunNext && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.runButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => runNextMutation.mutate()}
              disabled={runNextMutation.isPending}
            >
              {runNextMutation.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="#FFF" />
                  <Text style={styles.actionText}>Run Next Stage</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}

      {isComplete && (
        <View
          style={[
            styles.actionBar,
            styles.completeBar,
            {
              paddingBottom:
                Platform.OS === "web" ? 34 + 16 : insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={styles.completeText}>Workflow Complete</Text>
        </View>
      )}
    </View>
  );
}

function OverviewTab({ project, stage }: { project: any; stage: string }) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objective</Text>
        <Text style={styles.sectionBody}>{project.objective}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Constraints</Text>
        <Text style={styles.sectionBody}>{project.constraints}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workflow Progress</Text>
        {WORKFLOW_STEPS.map((step, i) => {
          const status = getStepStatus(step, stage);
          return (
            <View key={step.key} style={styles.workflowStep}>
              <View style={styles.stepIndicator}>
                <View
                  style={[
                    styles.stepCircle,
                    status === "complete" && styles.stepCircleComplete,
                    status === "active" && styles.stepCircleActive,
                    status === "pending" && styles.stepCirclePending,
                  ]}
                >
                  {status === "complete" ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : status === "active" ? (
                    <View style={styles.stepDotInner} />
                  ) : (
                    <Text style={styles.stepNumber}>{i + 1}</Text>
                  )}
                </View>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      status === "complete" && styles.stepLineComplete,
                    ]}
                  />
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text
                  style={[
                    styles.stepLabel,
                    status === "active" && styles.stepLabelActive,
                    status === "complete" && styles.stepLabelComplete,
                  ]}
                >
                  {step.label}
                </Text>
                <Text style={styles.stepStatus}>
                  {status === "complete"
                    ? "Done"
                    : status === "active"
                    ? STAGE_LABELS[stage] || stage
                    : "Pending"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>
            {new Date(project.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Updated</Text>
          <Text style={styles.detailValue}>
            {new Date(project.updatedAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Current Stage</Text>
          <Text style={[styles.detailValue, { color: Colors.accent }]}>
            {STAGE_LABELS[stage] || stage}
          </Text>
        </View>
      </View>
    </View>
  );
}

function IssuesTab({ issues }: { issues: any[] }) {
  if (issues.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Feather name="git-branch" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTabTitle}>No issues yet</Text>
        <Text style={styles.emptyTabText}>
          Run the Issues Tree agent to generate the issues breakdown
        </Text>
      </View>
    );
  }

  const latestVersion = Math.max(...issues.map((n) => n.version));
  const latestIssues = issues.filter((n) => n.version === latestVersion);
  const roots = latestIssues.filter((n) => !n.parentId);
  const children = latestIssues.filter((n) => !!n.parentId);

  return (
    <View style={styles.tabContent}>
      <View style={styles.versionBadgeRow}>
        <Text style={styles.versionBadge}>Version {latestVersion}</Text>
      </View>
      {roots.map((root) => (
        <View key={root.id} style={styles.issueRoot}>
          <View style={styles.issueRootHeader}>
            <View
              style={[
                styles.priorityDot,
                {
                  backgroundColor:
                    root.priority === "high"
                      ? Colors.error
                      : root.priority === "medium"
                      ? Colors.warning
                      : Colors.textMuted,
                },
              ]}
            />
            <Text style={styles.issueRootText}>{root.text}</Text>
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor:
                    root.priority === "high"
                      ? Colors.errorBg
                      : root.priority === "medium"
                      ? Colors.warningBg
                      : Colors.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.priorityText,
                  {
                    color:
                      root.priority === "high"
                        ? Colors.error
                        : root.priority === "medium"
                        ? Colors.warning
                        : Colors.textMuted,
                  },
                ]}
              >
                {root.priority}
              </Text>
            </View>
          </View>
          {children
            .filter((c) => c.parentId === root.id)
            .map((child) => (
              <View key={child.id} style={styles.issueChild}>
                <View style={styles.issueChildLine} />
                <View style={styles.issueChildContent}>
                  <Text style={styles.issueChildText}>{child.text}</Text>
                  <Text
                    style={[
                      styles.issueChildPriority,
                      {
                        color:
                          child.priority === "high"
                            ? Colors.error
                            : child.priority === "medium"
                            ? Colors.warning
                            : Colors.textMuted,
                      },
                    ]}
                  >
                    {child.priority}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}

function HypothesesTab({
  hypotheses,
  plans,
}: {
  hypotheses: any[];
  plans: any[];
}) {
  if (hypotheses.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="flask-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTabTitle}>No hypotheses yet</Text>
        <Text style={styles.emptyTabText}>
          Run the Hypothesis agent after approving the issues tree
        </Text>
      </View>
    );
  }

  const latestVersion = Math.max(...hypotheses.map((h) => h.version));
  const latest = hypotheses.filter((h) => h.version === latestVersion);

  return (
    <View style={styles.tabContent}>
      <View style={styles.versionBadgeRow}>
        <Text style={styles.versionBadge}>Version {latestVersion}</Text>
      </View>
      {latest.map((hyp, i) => {
        const plan = plans.find((p) => p.hypothesisId === hyp.id);
        return (
          <View key={hyp.id} style={styles.hypCard}>
            <Text style={styles.hypIndex}>H{i + 1}</Text>
            <Text style={styles.hypStatement}>{hyp.statement}</Text>
            <View style={styles.hypMeta}>
              <View style={styles.hypMetaItem}>
                <Feather name="target" size={12} color={Colors.textMuted} />
                <Text style={styles.hypMetaText}>{hyp.metric}</Text>
              </View>
              <View style={styles.hypMetaItem}>
                <Feather name="database" size={12} color={Colors.textMuted} />
                <Text style={styles.hypMetaText}>{hyp.dataSource}</Text>
              </View>
            </View>
            {plan && (
              <View style={styles.planBox}>
                <Text style={styles.planTitle}>Analysis Plan</Text>
                <Text style={styles.planMethod}>Method: {plan.method}</Text>
                <Text style={styles.planDataset}>
                  Dataset: {plan.requiredDataset}
                </Text>
                {plan.parametersJson && (
                  <Text style={styles.planParams}>
                    {JSON.stringify(plan.parametersJson, null, 2)}
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function RunsTab({ runs }: { runs: any[] }) {
  if (runs.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTabTitle}>No model runs yet</Text>
        <Text style={styles.emptyTabText}>
          Run the Execution agent after approving hypotheses
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {runs.map((run, i) => {
        const summary = (run.outputsJson as any)?.summary;
        return (
          <View key={run.id} style={styles.runCard}>
            <View style={styles.runHeader}>
              <MaterialCommunityIcons
                name="function-variant"
                size={18}
                color={Colors.accent}
              />
              <Text style={styles.runToolName}>{run.toolName}</Text>
              <Text style={styles.runDate}>
                {new Date(run.createdAt).toLocaleString()}
              </Text>
            </View>
            {summary && (
              <View style={styles.scenarioGrid}>
                <View style={styles.scenarioItem}>
                  <Text style={styles.scenarioLabel}>Pessimistic NPV</Text>
                  <Text style={[styles.scenarioValue, { color: Colors.error }]}>
                    ${summary.pessimisticNPV?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.scenarioItem}>
                  <Text style={styles.scenarioLabel}>Baseline NPV</Text>
                  <Text
                    style={[styles.scenarioValue, { color: Colors.accent }]}
                  >
                    ${summary.baselineNPV?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.scenarioItem}>
                  <Text style={styles.scenarioLabel}>Optimistic NPV</Text>
                  <Text
                    style={[styles.scenarioValue, { color: Colors.success }]}
                  >
                    ${summary.optimisticNPV?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.scenarioItem}>
                  <Text style={styles.scenarioLabel}>Expected Value</Text>
                  <Text style={styles.scenarioValueBold}>
                    ${summary.expectedValue?.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            <Pressable
              onPress={() => {}}
              style={styles.runDetails}
            >
              <Text style={styles.runDetailsLabel}>Inputs</Text>
              <Text style={styles.runDetailsText} numberOfLines={4}>
                {JSON.stringify(run.inputsJson, null, 2)}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function SummaryTab({ narratives }: { narratives: any[] }) {
  if (narratives.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons
          name="document-text-outline"
          size={40}
          color={Colors.textMuted}
        />
        <Text style={styles.emptyTabTitle}>No summary yet</Text>
        <Text style={styles.emptyTabText}>
          Run the Summary agent after approving execution results
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {narratives.map((narr) => (
        <View key={narr.id} style={styles.narrativeCard}>
          <View style={styles.narrativeHeader}>
            <Text style={styles.versionBadge}>Version {narr.version}</Text>
            <Text style={styles.narrativeDate}>
              {new Date(narr.createdAt).toLocaleString()}
            </Text>
          </View>
          <Text style={styles.narrativeText}>{narr.summaryText}</Text>
        </View>
      ))}
    </View>
  );
}

function LogsTab({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="terminal-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTabTitle}>No logs yet</Text>
        <Text style={styles.emptyTabText}>
          Agent run logs will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {logs.map((log) => (
        <View key={log.id} style={styles.logCard}>
          <View style={styles.logHeader}>
            <View
              style={[
                styles.logStatus,
                {
                  backgroundColor:
                    log.status === "success"
                      ? Colors.successBg
                      : log.status === "failed"
                      ? Colors.errorBg
                      : Colors.warningBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.logStatusText,
                  {
                    color:
                      log.status === "success"
                        ? Colors.success
                        : log.status === "failed"
                        ? Colors.error
                        : Colors.warning,
                  },
                ]}
              >
                {log.status}
              </Text>
            </View>
            <Text style={styles.logStage}>
              {STAGE_LABELS[log.stage] || log.stage}
            </Text>
            <Text style={styles.logModel}>{log.modelUsed}</Text>
          </View>
          <Text style={styles.logDate}>
            {new Date(log.createdAt).toLocaleString()}
          </Text>
          {log.errorText && (
            <Text style={styles.logError}>{log.errorText}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  tabContent: {
    gap: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  workflowStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
  },
  stepIndicator: {
    alignItems: "center",
    width: 28,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleComplete: {
    backgroundColor: Colors.success,
  },
  stepCircleActive: {
    backgroundColor: Colors.accent,
  },
  stepCirclePending: {
    backgroundColor: Colors.surfaceBorder,
  },
  stepDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  stepNumber: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: Colors.surfaceBorder,
    marginTop: 4,
  },
  stepLineComplete: {
    backgroundColor: Colors.success,
  },
  stepInfo: {
    flex: 1,
    paddingTop: 4,
  },
  stepLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  stepLabelActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
  stepLabelComplete: {
    color: Colors.text,
  },
  stepStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bg,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  completeBar: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  completeText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.success,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  runButton: {
    backgroundColor: Colors.accent,
  },
  actionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTabTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyTabText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  versionBadgeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  versionBadge: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
    backgroundColor: Colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  issueRoot: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  issueRootHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  issueRootText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  issueChild: {
    flexDirection: "row",
    marginTop: 10,
    marginLeft: 12,
    gap: 10,
  },
  issueChildLine: {
    width: 2,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 1,
  },
  issueChildContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  issueChildText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  issueChildPriority: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize" as const,
    marginLeft: 8,
  },
  hypCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  hypIndex: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    marginBottom: 6,
  },
  hypStatement: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  hypMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  hypMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hypMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  planBox: {
    backgroundColor: Colors.bg,
    borderRadius: 8,
    padding: 12,
  },
  planTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  planMethod: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    marginBottom: 2,
  },
  planDataset: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    marginBottom: 6,
  },
  planParams: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: Colors.textMuted,
    lineHeight: 16,
  },
  runCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  runHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  runToolName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  runDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  scenarioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  scenarioItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.bg,
    borderRadius: 8,
    padding: 10,
  },
  scenarioLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    marginBottom: 4,
  },
  scenarioValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  scenarioValueBold: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  runDetails: {
    backgroundColor: Colors.bg,
    borderRadius: 8,
    padding: 10,
  },
  runDetailsLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  runDetailsText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: Colors.textMuted,
    lineHeight: 16,
  },
  narrativeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  narrativeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  narrativeDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  narrativeText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  logStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logStatusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  logStage: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    flex: 1,
  },
  logModel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  logDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  logError: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.error,
    marginTop: 6,
    backgroundColor: Colors.errorBg,
    padding: 8,
    borderRadius: 6,
  },
});
