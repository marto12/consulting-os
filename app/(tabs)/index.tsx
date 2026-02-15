import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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

function getStageColor(stage: string) {
  if (stage === "complete") return Colors.success;
  if (stage.includes("approved")) return Colors.success;
  if (stage.includes("draft") || stage === "execution_done") return Colors.warning;
  return Colors.accent;
}

function getStageProgress(stage: string): number {
  const stages = [
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
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return (idx / (stages.length - 1)) * 100;
}

export default function ProjectListScreen() {
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [constraints, setConstraints] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects", {
        name,
        objective,
        constraints,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreate(false);
      setName("");
      setObjective("");
      setConstraints("");
    },
  });

  const renderProject = ({ item }: { item: any }) => {
    const stageColor = getStageColor(item.stage);
    const progress = getStageProgress(item.stage);
    const isPending =
      item.stage.includes("draft") || item.stage === "execution_done";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() =>
          router.push({
            pathname: "/project/[id]",
            params: { id: String(item.id) },
          })
        }
        testID={`project-card-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardObjective} numberOfLines={2}>
              {item.objective}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.stageBadge}>
            <View
              style={[styles.stageDot, { backgroundColor: stageColor }]}
            />
            <Text style={[styles.stageText, { color: stageColor }]}>
              {STAGE_LABELS[item.stage] || item.stage}
            </Text>
            {isPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Needs Review</Text>
              </View>
            )}
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: stageColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Projects</Text>
          <Text style={styles.headerSubtitle}>AI-Powered Strategy Workflow</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setShowCreate(true)}
          testID="create-project-btn"
        >
          <Feather name="plus" size={20} color="#FFF" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : !projects || projects.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="briefcase-outline"
            size={48}
            color={Colors.textMuted}
          />
          <Text style={styles.emptyTitle}>No projects yet</Text>
          <Text style={styles.emptyText}>
            Create your first project to start the AI consulting workflow
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={renderProject}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowCreate(false)}
          >
            <Pressable
              style={[
                styles.modalContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              onPress={() => {}}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New Project</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                <Text style={styles.inputLabel}>Project Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Market Entry Strategy"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  testID="project-name-input"
                />

                <Text style={styles.inputLabel}>Objective</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What should this project achieve?"
                  placeholderTextColor={Colors.textMuted}
                  value={objective}
                  onChangeText={setObjective}
                  multiline
                  numberOfLines={3}
                  testID="project-objective-input"
                />

                <Text style={styles.inputLabel}>Constraints</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Budget limits, timeline, resources..."
                  placeholderTextColor={Colors.textMuted}
                  value={constraints}
                  onChangeText={setConstraints}
                  multiline
                  numberOfLines={3}
                  testID="project-constraints-input"
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && { opacity: 0.85 },
                    (!name || !objective || !constraints) && styles.submitDisabled,
                  ]}
                  onPress={() => createMutation.mutate()}
                  disabled={
                    !name ||
                    !objective ||
                    !constraints ||
                    createMutation.isPending
                  }
                  testID="submit-project-btn"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitText}>Create Project</Text>
                  )}
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  cardObjective: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  pendingBadge: {
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  pendingText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.warning,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    width: 60,
    height: 4,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    width: 30,
    textAlign: "right",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});
