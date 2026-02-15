import React, { useState, useCallback, useEffect } from "react";
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
import IssuesGraph from "@/components/IssuesGraph";

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
  presentation_draft: "Presentation Draft",
  complete: "Complete",
};

const WORKFLOW_STEPS = [
  { key: "issues", label: "Issues Tree", stages: ["issues_draft", "issues_approved"] },
  { key: "hypotheses", label: "Hypotheses", stages: ["hypotheses_draft", "hypotheses_approved"] },
  { key: "execution", label: "Execution", stages: ["execution_done", "execution_approved"] },
  { key: "summary", label: "Summary", stages: ["summary_draft", "summary_approved"] },
  { key: "presentation", label: "Presentation", stages: ["presentation_draft", "complete"] },
];

const TABS = ["overview", "issues", "hypotheses", "runs", "summary", "presentation", "logs"] as const;
type TabKey = (typeof TABS)[number];

const TAB_CONFIG: Record<TabKey, { label: string; icon: string }> = {
  overview: { label: "Overview", icon: "layers-outline" },
  issues: { label: "Issues", icon: "git-branch-outline" },
  hypotheses: { label: "Hypotheses", icon: "flask-outline" },
  runs: { label: "Runs", icon: "bar-chart-outline" },
  summary: { label: "Summary", icon: "document-text-outline" },
  presentation: { label: "Slides", icon: "easel-outline" },
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
    "summary_approved",
    "presentation_draft",
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
  return ["created", "issues_approved", "hypotheses_approved", "execution_approved", "summary_approved"].includes(stage);
}

function canApprove(stage: string): boolean {
  return ["issues_draft", "hypotheses_draft", "execution_done", "summary_draft", "presentation_draft"].includes(stage);
}

const STAGE_TO_TAB: Record<string, TabKey> = {
  issues_draft: "issues",
  issues_approved: "issues",
  hypotheses_draft: "hypotheses",
  hypotheses_approved: "hypotheses",
  execution_done: "runs",
  execution_approved: "runs",
  summary_draft: "summary",
  summary_approved: "summary",
  presentation_draft: "presentation",
  complete: "overview",
};

const STAGE_AGENT_INFO: Record<string, { agent: string; description: string }> = {
  created: {
    agent: "Issues Tree Agent",
    description: "Decomposing objective into MECE issues tree...",
  },
  issues_approved: {
    agent: "Hypothesis Agent",
    description: "Generating hypotheses and analysis plans...",
  },
  hypotheses_approved: {
    agent: "Execution Agent",
    description: "Running scenario analysis with calculator tool...",
  },
  execution_approved: {
    agent: "Summary Agent",
    description: "Writing executive summary from results...",
  },
  summary_approved: {
    agent: "Presentation Agent",
    description: "Generating 16:9 presentation slides...",
  },
};

function useAnimatedDots() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return dots;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [runElapsed, setRunElapsed] = useState(0);

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

  const redoMutation = useMutation({
    mutationFn: async (step: string) => {
      const res = await apiRequest("POST", `/api/projects/${id}/redo`, { step });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "logs"] });
    },
    onError: (err: Error) => {
      if (Platform.OS === "web") {
        window.alert(err.message);
      } else {
        Alert.alert("Error", err.message);
      }
    },
  });

  const handleRedo = (step: string, label: string) => {
    const msg = `This will reset the workflow back before "${label}" and re-run the analysis. Any later results will need to be regenerated. Continue?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        redoMutation.mutate(step);
      }
    } else {
      Alert.alert("Redo Analysis", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Redo", style: "destructive", onPress: () => redoMutation.mutate(step) },
      ]);
    }
  };

  const runNextMutation = useMutation({
    mutationFn: async () => {
      setRunElapsed(0);
      const res = await apiRequest("POST", `/api/projects/${id}/run-next`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setRunElapsed(0);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "logs"],
      });
      const newStage = data?.stage;
      if (newStage && STAGE_TO_TAB[newStage]) {
        setActiveTab(STAGE_TO_TAB[newStage]);
      }
    },
    onError: (err: Error) => {
      setRunElapsed(0);
      if (Platform.OS === "web") {
        window.alert(err.message);
      } else {
        Alert.alert("Error", err.message);
      }
    },
  });

  useEffect(() => {
    if (!runNextMutation.isPending) return;
    const interval = setInterval(() => {
      setRunElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [runNextMutation.isPending]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/approve`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", id, "artifacts"],
      });
      const newStage = data?.stage;
      if (newStage === "complete") {
        setActiveTab("overview");
      }
    },
    onError: (err: Error) => {
      if (Platform.OS === "web") {
        window.alert(err.message);
      } else {
        Alert.alert("Error", err.message);
      }
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

  useEffect(() => {
    if (project && !hasAutoNavigated) {
      const tab = STAGE_TO_TAB[project.stage];
      if (tab) {
        setActiveTab(tab);
      }
      setHasAutoNavigated(true);
    }
  }, [project, hasAutoNavigated]);

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
            onRedo={handleRedo}
            redoPending={redoMutation.isPending}
          />
        )}
        {activeTab === "issues" && (
          <IssuesTab
            issues={artifacts?.issueNodes || []}
            showApprove={showApprove && stage === "issues_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "hypotheses" && (
          <HypothesesTab
            hypotheses={artifacts?.hypotheses || []}
            plans={artifacts?.analysisPlan || []}
            showApprove={showApprove && stage === "hypotheses_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "runs" && (
          <RunsTab
            runs={artifacts?.modelRuns || []}
            showApprove={showApprove && stage === "execution_done"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "summary" && (
          <SummaryTab
            narratives={artifacts?.narratives || []}
            showApprove={showApprove && stage === "summary_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "presentation" && (
          <PresentationTab
            slides={artifacts?.slides || []}
            showApprove={showApprove && stage === "presentation_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "logs" && <LogsTab logs={logs || []} />}
      </ScrollView>

      {runNextMutation.isPending && (
        <RunningStatusBar
          stage={stage}
          elapsed={runElapsed}
          bottomPadding={Platform.OS === "web" ? 34 + 16 : insets.bottom + 16}
        />
      )}

      {!runNextMutation.isPending && showRunNext && !isComplete && (
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom:
                Platform.OS === "web" ? 34 + 16 : insets.bottom + 16,
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.runButton,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => runNextMutation.mutate()}
            disabled={runNextMutation.isPending}
          >
            <>
              <Ionicons name="play-circle" size={20} color="#FFF" />
              <Text style={styles.actionText}>Run Next Agent</Text>
            </>
          </Pressable>
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

function RunningStatusBar({
  stage,
  elapsed,
  bottomPadding,
}: {
  stage: string;
  elapsed: number;
  bottomPadding: number;
}) {
  const dots = useAnimatedDots();
  const info = STAGE_AGENT_INFO[stage];
  const agentName = info?.agent || "Agent";
  const description = info?.description || "Processing...";

  const phases = [
    { threshold: 0, label: "Initializing" },
    { threshold: 3, label: description.replace("...", "") },
    { threshold: 15, label: "Analyzing with AI" },
    { threshold: 30, label: "Reviewing quality" },
    { threshold: 50, label: "Finalizing output" },
  ];

  let currentPhase = phases[0].label;
  for (const p of phases) {
    if (elapsed >= p.threshold) currentPhase = p.label;
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;

  return (
    <View style={[styles.runningBar, { paddingBottom: bottomPadding }]}>
      <View style={styles.runningBarContent}>
        <View style={styles.runningBarTop}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.runningBarAgent}>{agentName}</Text>
          <Text style={styles.runningBarTime}>{timeStr}</Text>
        </View>
        <Text style={styles.runningBarStatus}>{currentPhase}{dots}</Text>
      </View>
    </View>
  );
}

function OverviewTab({
  project,
  stage,
  onRedo,
  redoPending,
}: {
  project: any;
  stage: string;
  onRedo: (step: string, label: string) => void;
  redoPending: boolean;
}) {
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
                <View style={styles.stepInfoRow}>
                  <View style={{ flex: 1 }}>
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
                  {(status === "complete" || status === "active") && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.redoButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => onRedo(step.key, step.label)}
                      disabled={redoPending}
                      testID={`redo-${step.key}`}
                    >
                      {redoPending ? (
                        <ActivityIndicator size={12} color={Colors.textMuted} />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={13} color={Colors.textSecondary} />
                          <Text style={styles.redoButtonText}>Redo</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
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

interface ApproveProps {
  showApprove: boolean;
  onApprove: () => void;
  approvePending: boolean;
}

function InlineApproveButton({ showApprove, onApprove, approvePending }: ApproveProps) {
  if (!showApprove) return null;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.inlineApproveBtn,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onApprove}
      disabled={approvePending}
    >
      {approvePending ? (
        <ActivityIndicator color="#FFF" size="small" />
      ) : (
        <>
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.inlineApproveBtnText}>Approve & Continue</Text>
        </>
      )}
    </Pressable>
  );
}

function IssuesTab({ issues, showApprove, onApprove, approvePending }: { issues: any[] } & ApproveProps) {
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

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

  function getDescendants(parentId: number): any[] {
    const directChildren = latestIssues.filter((n) => n.parentId === parentId);
    return directChildren;
  }

  function renderIssueNode(node: any, depth: number): React.ReactNode {
    const nodeChildren = getDescendants(node.id);
    const priorityColor =
      node.priority === "high"
        ? Colors.error
        : node.priority === "medium"
        ? Colors.warning
        : Colors.textMuted;

    return (
      <View key={node.id} style={[depth > 0 && styles.issueChild]}>
        {depth > 0 && <View style={styles.issueChildLine} />}
        <View style={depth === 0 ? styles.issueRootHeader : styles.issueChildContent}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={depth === 0 ? styles.issueRootText : styles.issueChildText}>
            {node.text}
          </Text>
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor:
                  node.priority === "high"
                    ? Colors.errorBg
                    : node.priority === "medium"
                    ? Colors.warningBg
                    : Colors.bg,
              },
            ]}
          >
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {node.priority}
            </Text>
          </View>
        </View>
        {nodeChildren.length > 0 && (
          <View style={{ marginLeft: 16 }}>
            {nodeChildren.map((child) => renderIssueNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.viewToggleRow}>
        <View style={styles.versionBadgeRow}>
          <Text style={styles.versionBadge}>Version {latestVersion}</Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === "graph" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("graph")}
          >
            <MaterialCommunityIcons
              name="graph-outline"
              size={16}
              color={viewMode === "graph" ? Colors.accent : Colors.textMuted}
            />
          </Pressable>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("list")}
          >
            <Feather
              name="list"
              size={16}
              color={viewMode === "list" ? Colors.accent : Colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      {viewMode === "graph" ? (
        <IssuesGraph issues={latestIssues} />
      ) : (
        roots.map((root) => (
          <View key={root.id} style={styles.issueRoot}>
            {renderIssueNode(root, 0)}
          </View>
        ))
      )}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </View>
  );
}

function HypothesesTab({
  hypotheses,
  plans,
  showApprove,
  onApprove,
  approvePending,
}: {
  hypotheses: any[];
  plans: any[];
} & ApproveProps) {
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
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </View>
  );
}

function RunsTab({ runs, showApprove, onApprove, approvePending }: { runs: any[] } & ApproveProps) {
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
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </View>
  );
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  function renderInline(line: string, key: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)/g;
    let lastIndex = 0;
    let match;
    let partIdx = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`${key}-t${partIdx++}`} style={styles.mdBody}>
            {line.slice(lastIndex, match.index)}
          </Text>
        );
      }
      parts.push(
        <Text key={`${key}-b${partIdx++}`} style={styles.mdBold}>
          {match[2] || match[4]}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(
        <Text key={`${key}-t${partIdx++}`} style={styles.mdBody}>
          {line.slice(lastIndex)}
        </Text>
      );
    }
    if (parts.length === 0) {
      return <Text key={key} style={styles.mdBody}>{line}</Text>;
    }
    return <Text key={key}>{parts}</Text>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      elements.push(<View key={`sp-${i}`} style={{ height: 8 }} />);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={`h3-${i}`} style={styles.mdH3}>
          {trimmed.slice(4)}
        </Text>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <Text key={`h2-${i}`} style={styles.mdH2}>
          {trimmed.slice(3)}
        </Text>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <Text key={`h1-${i}`} style={styles.mdH1}>
          {trimmed.slice(2)}
        </Text>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <View key={`li-${i}`} style={styles.mdBulletRow}>
          <Text style={styles.mdBulletDot}>{"\u2022"}</Text>
          <View style={{ flex: 1 }}>
            {renderInline(trimmed.slice(2), `li-${i}`)}
          </View>
        </View>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <View key={`ol-${i}`} style={styles.mdBulletRow}>
            <Text style={styles.mdOrderedNum}>{numMatch[1]}.</Text>
            <View style={{ flex: 1 }}>
              {renderInline(numMatch[2], `ol-${i}`)}
            </View>
          </View>
        );
      }
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(
        <View key={`hr-${i}`} style={styles.mdHr} />
      );
    } else {
      elements.push(
        <View key={`p-${i}`}>
          {renderInline(trimmed, `p-${i}`)}
        </View>
      );
    }
  }

  return <View style={styles.mdContainer}>{elements}</View>;
}

function SummaryTab({ narratives, showApprove, onApprove, approvePending }: { narratives: any[] } & ApproveProps) {
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
          <MarkdownText text={narr.summaryText} />
        </View>
      ))}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </View>
  );
}

function PresentationTab({ slides, showApprove, onApprove, approvePending }: { slides: any[] } & ApproveProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (slides.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="easel-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTabTitle}>No presentation yet</Text>
        <Text style={styles.emptyTabText}>
          Run the Presentation agent to generate a slide deck
        </Text>
      </View>
    );
  }

  const latestVersion = Math.max(...slides.map((s: any) => s.version));
  const latestSlides = slides
    .filter((s: any) => s.version === latestVersion)
    .sort((a: any, b: any) => a.slideIndex - b.slideIndex);

  const slide = latestSlides[currentSlide];
  if (!slide) return null;

  const body = typeof slide.bodyJson === "string" ? JSON.parse(slide.bodyJson) : slide.bodyJson;

  return (
    <View style={styles.tabContent}>
      <View style={styles.slideControls}>
        <Pressable
          onPress={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          style={({ pressed }) => [
            styles.slideNavBtn,
            currentSlide === 0 && { opacity: 0.3 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.slideCounter}>
          {currentSlide + 1} / {latestSlides.length}
        </Text>
        <Pressable
          onPress={() => setCurrentSlide(Math.min(latestSlides.length - 1, currentSlide + 1))}
          disabled={currentSlide === latestSlides.length - 1}
          style={({ pressed }) => [
            styles.slideNavBtn,
            currentSlide === latestSlides.length - 1 && { opacity: 0.3 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.slideWrapper}>
        <View style={styles.slideFrame}>
          {slide.layout === "title_slide" && (
            <View style={styles.slideTitleLayout}>
              <View style={styles.slideTitleAccent} />
              <Text style={styles.slideTitleMain}>{slide.title}</Text>
              {slide.subtitle && (
                <Text style={styles.slideTitleSub}>{slide.subtitle}</Text>
              )}
            </View>
          )}

          {slide.layout === "section_header" && (
            <View style={styles.slideSectionLayout}>
              <View style={styles.slideSectionBar} />
              <Text style={styles.slideSectionTitle}>{slide.title}</Text>
              {slide.subtitle && (
                <Text style={styles.slideSectionSub}>{slide.subtitle}</Text>
              )}
            </View>
          )}

          {slide.layout === "title_body" && (
            <View style={styles.slideBodyLayout}>
              <Text style={styles.slideBodyTitle}>{slide.title}</Text>
              {slide.subtitle && (
                <Text style={styles.slideBodySubtitle}>{slide.subtitle}</Text>
              )}
              {body?.bullets && (
                <View style={styles.slideBullets}>
                  {body.bullets.map((b: string, i: number) => (
                    <View key={i} style={styles.slideBulletRow}>
                      <View style={styles.slideBulletDot} />
                      <Text style={styles.slideBulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {slide.layout === "two_column" && (
            <View style={styles.slideBodyLayout}>
              <Text style={styles.slideBodyTitle}>{slide.title}</Text>
              <View style={styles.slideTwoCol}>
                <View style={styles.slideCol}>
                  <Text style={styles.slideColTitle}>{body?.leftTitle || "Left"}</Text>
                  {(body?.leftBullets || []).map((b: string, i: number) => (
                    <View key={i} style={styles.slideBulletRow}>
                      <View style={styles.slideBulletDot} />
                      <Text style={styles.slideBulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.slideColDivider} />
                <View style={styles.slideCol}>
                  <Text style={styles.slideColTitle}>{body?.rightTitle || "Right"}</Text>
                  {(body?.rightBullets || []).map((b: string, i: number) => (
                    <View key={i} style={styles.slideBulletRow}>
                      <View style={styles.slideBulletDot} />
                      <Text style={styles.slideBulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {slide.layout === "metrics" && (
            <View style={styles.slideBodyLayout}>
              <Text style={styles.slideBodyTitle}>{slide.title}</Text>
              <View style={styles.slideMetricsGrid}>
                {(body?.metrics || []).map((m: any, i: number) => (
                  <View key={i} style={styles.slideMetricCard}>
                    <Text style={styles.slideMetricValue}>{m.value}</Text>
                    <Text style={styles.slideMetricLabel}>{m.label}</Text>
                    {m.change && (
                      <Text style={[
                        styles.slideMetricChange,
                        { color: m.change.startsWith("+") ? Colors.success : m.change.startsWith("-") ? Colors.error : Colors.accent },
                      ]}>
                        {m.change}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {slide.notesText && (
        <View style={styles.slideNotesBox}>
          <Text style={styles.slideNotesLabel}>Speaker Notes</Text>
          <Text style={styles.slideNotesText}>{slide.notesText}</Text>
        </View>
      )}

      <View style={styles.slideThumbnails}>
        {latestSlides.map((s: any, i: number) => (
          <Pressable
            key={s.id}
            onPress={() => setCurrentSlide(i)}
            style={[
              styles.slideThumbnail,
              i === currentSlide && styles.slideThumbnailActive,
            ]}
          >
            <Text style={[
              styles.slideThumbnailText,
              i === currentSlide && styles.slideThumbnailTextActive,
            ]} numberOfLines={2}>
              {s.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
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
  stepInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  redoButtonText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
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
  runningBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: Colors.accent,
  },
  runningBarContent: {
    gap: 6,
  },
  runningBarTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  runningBarAgent: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  runningBarTime: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  runningBarStatus: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginLeft: 30,
    marginBottom: 2,
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
  viewToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.bg,
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
  inlineApproveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  inlineApproveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  mdContainer: {
    gap: 2,
  },
  mdH1: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  mdH2: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 8,
    marginBottom: 3,
  },
  mdBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  mdBold: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 22,
  },
  mdBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingLeft: 4,
  },
  mdBulletDot: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.accent,
    lineHeight: 22,
    width: 12,
  },
  mdOrderedNum: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
    lineHeight: 22,
    width: 20,
  },
  mdHr: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 10,
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
  slideControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 12,
  },
  slideNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  slideCounter: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    minWidth: 50,
    textAlign: "center" as const,
  },
  slideWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  slideFrame: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    padding: 24,
  },
  slideTitleLayout: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  slideTitleAccent: {
    width: 60,
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
    marginBottom: 8,
  },
  slideTitleMain: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center" as const,
  },
  slideTitleSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
  },
  slideSectionLayout: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 16,
  },
  slideSectionBar: {
    width: 4,
    height: 40,
    backgroundColor: Colors.accent,
    borderRadius: 2,
    marginBottom: 16,
  },
  slideSectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  slideSectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
  },
  slideBodyLayout: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 8,
  },
  slideBodyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  slideBodySubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  slideBullets: {
    gap: 6,
    marginTop: 4,
  },
  slideBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  slideBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 5,
  },
  slideBulletText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 18,
  },
  slideTwoCol: {
    flexDirection: "row",
    flex: 1,
    gap: 8,
    marginTop: 4,
  },
  slideCol: {
    flex: 1,
    gap: 6,
  },
  slideColTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
    marginBottom: 4,
  },
  slideColDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  slideMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    flex: 1,
    alignContent: "center" as const,
  },
  slideMetricCard: {
    flex: 1,
    minWidth: "28%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  slideMetricValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  slideMetricLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  slideMetricChange: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  slideNotesBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  slideNotesLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  slideNotesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  slideThumbnails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slideThumbnail: {
    width: 80,
    height: 45,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  slideThumbnailActive: {
    borderColor: Colors.accent,
    borderWidth: 2,
    backgroundColor: "#EBF2FF",
  },
  slideThumbnailText: {
    fontSize: 7,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: "center" as const,
  },
  slideThumbnailTextActive: {
    color: Colors.accent,
  },
});
