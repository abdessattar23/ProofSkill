<script lang="ts">
  import { page } from "$app/stores";
  import { auth } from "$lib/stores/auth";
  import { apiClient } from "$lib/api/client";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  const sessionId = $page.params.sessionId;

  let sessionSummary: any = null;
  let loading = true;

  onMount(async () => {
    if (!sessionId) {
      toastStore.push("Invalid session ID", { type: "error" });
      goto("/dashboard");
      return;
    }

    await loadSessionSummary();
  });

  async function loadSessionSummary() {
    try {
      const response = await fetch(
        `/v1/api/interview/sessions/${sessionId}/summary`,
        {
          headers: {
            Authorization: `Bearer ${$auth.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load session summary");
      }

      sessionSummary = await response.json();
      loading = false;
    } catch (error) {
      console.error("Error loading session summary:", error);
      toastStore.push("Failed to load interview summary", { type: "error" });
      goto("/dashboard");
    }
  }
</script>

<svelte:head>
  <title>Interview Summary - ProofSkill AI</title>
</svelte:head>

<div
  class="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black p-8"
>
  {#if loading}
    <div class="flex items-center justify-center h-screen">
      <div class="flex flex-col items-center space-y-4">
        <div
          class="w-20 h-20 border-4 border-gray-600 border-t-white rounded-full animate-spin"
        ></div>
        <p class="text-gray-400">Loading interview summary...</p>
      </div>
    </div>
  {:else if sessionSummary}
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Interview Complete!</h1>
        <p class="text-gray-400">Here's how you performed</p>
      </div>

      <!-- Score Summary -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="text-3xl font-bold text-white mb-2">
              {sessionSummary.averageScore
                ? Math.round(sessionSummary.averageScore * 10) / 10
                : "N/A"}
            </div>
            <div class="text-gray-400">Average Score</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white mb-2">
              {sessionSummary.answered || 0}
            </div>
            <div class="text-gray-400">Questions Answered</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white mb-2">
              {sessionSummary.totalQuestions || 0}
            </div>
            <div class="text-gray-400">Total Questions</div>
          </div>
        </div>
      </div>

      <!-- Detailed Results -->
      {#if sessionSummary.items && sessionSummary.items.length > 0}
        <div class="space-y-4 mb-8">
          <h2 class="text-xl font-semibold text-white mb-4">
            Question Results
          </h2>
          {#each sessionSummary.items as item, index}
            <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                  <h3 class="text-lg font-medium text-white mb-2">
                    Question {index + 1}: {item.skill}
                  </h3>
                  <p class="text-gray-300 mb-4">{item.question}</p>

                  {#if item.answer}
                    <div class="mb-4">
                      <p class="text-sm text-gray-400 mb-2">Your Answer:</p>
                      <p class="text-gray-200 bg-gray-900 p-3 rounded border">
                        {item.answer.transcript_full ||
                          "No transcript available"}
                      </p>
                    </div>
                  {/if}
                </div>

                {#if item.answer && typeof item.answer.score === "number"}
                  <div class="ml-4 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                      {Math.round(item.answer.score * 10) / 10}
                    </div>
                    <div class="text-sm text-gray-400">Score</div>
                  </div>
                {/if}
              </div>

              {#if item.answer && item.answer.reasoning}
                <div class="border-t border-gray-700 pt-4">
                  <p class="text-sm text-gray-400 mb-2">Feedback:</p>
                  <p class="text-gray-300">{item.answer.reasoning}</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Actions -->
      <div class="text-center space-y-4">
        <a
          href="/dashboard"
          class="inline-block px-8 py-3 bg-slate-700 hover:bg-slate-600 border border-gray-600 rounded-lg text-white font-medium transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  {:else}
    <div class="flex items-center justify-center h-screen">
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-4 text-white">
          Summary Not Available
        </h2>
        <p class="text-gray-400 mb-6">Could not load the interview summary.</p>
        <a
          href="/dashboard"
          class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >Return to Dashboard</a
        >
      </div>
    </div>
  {/if}
</div>
