<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  let loading = true;
  let evaluations: any[] = [];
  let overallStats = {
    totalInterviews: 0,
    averageScore: 0,
    completedSkills: 0,
  };

  onMount(async () => {
    if (!$auth.user) {
      goto("/auth/login");
      return;
    }

    await loadResults();
  });

  async function loadResults() {
    try {
      // This would typically fetch user's interview results
      // For now, we'll create mock data since the endpoint might not be implemented yet

      // Simulate API call
      setTimeout(() => {
        evaluations = [
          {
            id: "1",
            date: new Date().toISOString(),
            skills: [
              {
                skill: "JavaScript",
                score: 85,
                feedback: "Strong understanding of core concepts",
              },
              {
                skill: "React",
                score: 78,
                feedback: "Good component design skills",
              },
              {
                skill: "Node.js",
                score: 72,
                feedback: "Solid backend development knowledge",
              },
            ],
            overallScore: 78,
            status: "completed",
          },
        ];

        overallStats = {
          totalInterviews: evaluations.length,
          averageScore:
            evaluations.reduce((sum, eval) => sum + eval.overallScore, 0) /
            evaluations.length,
          completedSkills: evaluations.reduce(
            (sum, eval) => sum + eval.skills.length,
            0
          ),
        };

        loading = false;
      }, 1000);
    } catch (error) {
      console.error("Failed to load results:", error);
      loading = false;
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  }

  function getScoreBg(score: number) {
    if (score >= 80) return "bg-success/10";
    if (score >= 60) return "bg-warning/10";
    return "bg-destructive/10";
  }
</script>

<svelte:head>
  <title>Assessment Results - ProofSkill AI</title>
</svelte:head>

<div class="space-y-8">
  <!-- Header -->
  <div class="text-center py-8">
    <h1 class="text-3xl font-bold mb-4">Your Assessment Results</h1>
    <p class="text-lg text-muted-foreground">
      Track your progress and see detailed feedback on your skills
    </p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center space-y-4">
        <div class="spinner h-8 w-8"></div>
        <p class="text-sm text-muted-foreground">Loading your results...</p>
      </div>
    </div>
  {:else if evaluations.length === 0}
    <!-- No Results Yet -->
    <div class="text-center py-20">
      <div
        class="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <svg
          class="h-8 w-8 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      </div>
      <h2 class="text-xl font-semibold mb-4">No Assessment Results Yet</h2>
      <p class="text-muted-foreground mb-6">
        Complete your first skills assessment to see your results here.
      </p>
      <a href="/assessment/start" class="btn btn-primary">Start Assessment</a>
    </div>
  {:else}
    <!-- Overall Statistics -->
    <div class="grid md:grid-cols-3 gap-6">
      <div class="card p-6 text-center">
        <div
          class="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="h-6 w-6 text-brand"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-brand">
          {overallStats.totalInterviews}
        </h3>
        <p class="text-sm text-muted-foreground">Completed Interviews</p>
      </div>

      <div class="card p-6 text-center">
        <div
          class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="h-6 w-6 text-success"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-success">
          {Math.round(overallStats.averageScore)}%
        </h3>
        <p class="text-sm text-muted-foreground">Average Score</p>
      </div>

      <div class="card p-6 text-center">
        <div
          class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="h-6 w-6 text-warning"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-warning">
          {overallStats.completedSkills}
        </h3>
        <p class="text-sm text-muted-foreground">Skills Assessed</p>
      </div>
    </div>

    <!-- Recent Results -->
    <div class="space-y-6">
      <h2 class="text-xl font-semibold">Recent Assessment Results</h2>

      {#each evaluations as evaluation}
        <div class="card p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-semibold">Technical Interview</h3>
              <p class="text-sm text-muted-foreground">
                Completed on {new Date(evaluation.date).toLocaleDateString()}
              </p>
            </div>
            <div class="text-right">
              <div
                class="text-2xl font-bold {getScoreColor(
                  evaluation.overallScore
                )}"
              >
                {evaluation.overallScore}%
              </div>
              <p class="text-xs text-muted-foreground">Overall Score</p>
            </div>
          </div>

          <!-- Skills Breakdown -->
          <div class="space-y-4">
            <h4 class="font-medium">Skills Performance:</h4>
            <div class="space-y-3">
              {#each evaluation.skills as skillResult}
                <div
                  class="flex items-center justify-between p-4 {getScoreBg(
                    skillResult.score
                  )} rounded-lg"
                >
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-medium">{skillResult.skill}</span>
                      <span
                        class="font-semibold {getScoreColor(skillResult.score)}"
                      >
                        {skillResult.score}%
                      </span>
                    </div>
                    <div class="w-full bg-surface rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all duration-300 {skillResult.score >=
                        80
                          ? 'bg-success'
                          : skillResult.score >= 60
                            ? 'bg-warning'
                            : 'bg-destructive'}"
                        style="width: {skillResult.score}%"
                      ></div>
                    </div>
                    <p class="text-sm text-muted-foreground mt-2">
                      {skillResult.feedback}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Actions -->
          <div
            class="flex justify-end space-x-3 mt-6 pt-6 border-t border-border"
          >
            <button class="btn btn-outline"> View Detailed Report </button>
            <button class="btn btn-primary"> Retake Assessment </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Call to Action -->
    <div class="card p-8 text-center bg-gradient-to-r from-brand/5 to-brand/10">
      <h3 class="text-xl font-semibold mb-4">Ready for More Challenges?</h3>
      <p class="text-muted-foreground mb-6">
        Continue improving your skills with additional assessments and practice
        interviews.
      </p>
      <div class="flex justify-center space-x-4">
        <a href="/assessment/start" class="btn btn-primary"
          >Take Another Assessment</a
        >
        <a href="/interview/voice" class="btn btn-outline">Practice Interview</a
        >
      </div>
    </div>
  {/if}
</div>
