<script lang="ts">
  import { page } from "$app/stores";
  import { auth } from "$lib/stores/auth";
  import { apiClient } from "$lib/api/client";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";

  const sessionId = $page.params.sessionId;

  let sessionData: any = null;
  let loading = true;
  let currentQuestionIndex = 0;
  let userAnswer = "";
  let questions: any[] = [];
  let isRecording = false;
  let isPlaying = false;
  let answers: Array<{ question: string; answer: string; skill: string }> = [];
  let audioRef: HTMLAudioElement;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let recordingTime = 0;
  let recordingTimer: NodeJS.Timeout | null = null;
  let currentAudio: HTMLAudioElement | null = null;

  onMount(async () => {
    if (!sessionId) {
      toastStore.push("Invalid session ID", { type: "error" });
      goto("/dashboard");
      return;
    }

    await loadSession();
    await requestMicrophonePermission();
  });

  onDestroy(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingTimer) {
      clearInterval(recordingTimer);
    }
    if (currentAudio) {
      currentAudio.pause();
    }
  });

  async function requestMicrophonePermission() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      toastStore.push("Microphone access is required for voice interview", {
        type: "error",
      });
    }
  }

  async function loadSession() {
    try {
      // Fetch session data
      const sessionResponse = await apiClient.getInterviewSession(sessionId);

      if (sessionResponse.success && sessionResponse.data) {
        sessionData = sessionResponse.data;
      } else {
        toastStore.push("Failed to load interview session", { type: "error" });
        goto("/dashboard");
        return;
      }

      // Fetch questions separately
      const questionsResponse = await apiClient.getSessionQuestions(sessionId);

      if (questionsResponse.success && questionsResponse.data) {
        questions = questionsResponse.data.questions || [];
        if (questions.length > 0) {
          setTimeout(() => {
            playQuestionAudio();
          }, 1000);
        }
      } else {
        toastStore.push("Failed to load interview questions", {
          type: "error",
        });
        goto("/dashboard");
        return;
      }

      loading = false;
    } catch (error) {
      toastStore.push("Error loading interview session", { type: "error" });
      goto("/dashboard");
    }
  }

  async function playQuestionAudio() {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion?.audio?.url) {
      setTimeout(() => {
        startRecording();
      }, 500);
      return;
    }

    try {
      isPlaying = true;

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      currentAudio = new Audio();
      currentAudio.crossOrigin = "anonymous";
      currentAudio.preload = "auto";

      currentAudio.onended = () => {
        isPlaying = false;
        currentAudio = null;
        setTimeout(() => {
          startRecording();
        }, 500);
      };

      currentAudio.onerror = () => {
        isPlaying = false;
        currentAudio = null;
        setTimeout(() => {
          startRecording();
        }, 500);
      };

      currentAudio.src = currentQuestion.audio.url;
      await currentAudio.play();
    } catch (error) {
      isPlaying = false;
      currentAudio = null;
      setTimeout(() => {
        startRecording();
      }, 500);
    }
  }

  function startRecording() {
    if (!stream) {
      toastStore.push("Microphone not available", { type: "error" });
      return;
    }

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      convertAudioToText(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    recordingTime = 0;

    recordingTimer = setInterval(() => {
      recordingTime++;
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;

      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
    }
  }

  async function convertAudioToText(audioBlob: Blob) {
    try {
      loading = true;
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch(
        `/v1/api/interview/sessions/${sessionId}/questions/${questions[currentQuestionIndex].id}/audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${$auth.token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        if (response.status === 409) {
          toastStore.push("Answer already submitted for this question", {
            type: "info",
          });
          return;
        }
        throw new Error("Failed to transcribe audio");
      }

      const result = await response.json();
      userAnswer = result.transcript || "";

      if (userAnswer.trim()) {
        toastStore.push("Voice processed successfully!", { type: "success" });

        // Store the answer locally for display
        answers.push({
          question: questions[currentQuestionIndex].question,
          answer: userAnswer.trim(),
          skill: questions[currentQuestionIndex].skill,
        });

        // Automatically proceed to next question after a brief delay
        setTimeout(async () => {
          if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            userAnswer = "";
            // Auto-play next question
            setTimeout(() => {
              playQuestionAudio();
            }, 500);
          } else {
            await completeInterview();
          }
        }, 1500);
      } else {
        toastStore.push(
          "Could not understand audio. Please try speaking again.",
          { type: "warning" }
        );
      }
    } catch (error) {
      toastStore.push("Failed to process voice recording", { type: "error" });
      userAnswer = "";
    } finally {
      loading = false;
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async function submitAnswer() {
    // This function is now mainly for manual progression if needed
    try {
      loading = true;

      // Move to next question or complete interview
      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        userAnswer = "";
        // Auto-play next question
        setTimeout(() => {
          playQuestionAudio();
        }, 1000);
      } else {
        await completeInterview();
      }
    } catch (error) {
      toastStore.push("Failed to proceed to next question", { type: "error" });
    } finally {
      loading = false;
    }
  }

  async function completeInterview() {
    loading = true;

    try {
      // Update session status to completed
      const response = await fetch(`/v1/api/interview/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${$auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "completed",
        }),
      });

      if (response.ok) {
        // Mark profile as complete (for first-time users)
        if ($auth.user && $auth.user.first_time) {
          try {
            const profileResponse = await fetch(
              "/v1/api/auth/profile-complete",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${$auth.token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (profileResponse.ok) {
              // Update auth store to reflect profile completion
              auth.update((current) => ({
                ...current,
                user: {
                  ...current.user,
                  first_time: false,
                },
              }));
            }
          } catch (profileError) {
            // Don't fail the interview completion if profile update fails
            console.warn(
              "Failed to update profile completion status:",
              profileError
            );
          }
        }

        toastStore.push("Interview completed successfully!", {
          type: "success",
        });
        goto(`/interview/session/${sessionId}/summary`);
      } else {
        toastStore.push("Failed to complete interview", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error completing interview", { type: "error" });
    } finally {
      loading = false;
    }
  }

  async function skipQuestion() {
    const currentQuestion = questions[currentQuestionIndex];

    try {
      loading = true;

      // Submit "skipped" as the answer
      const response = await fetch(
        `/v1/api/interview/sessions/${sessionId}/questions/${currentQuestion.id}/answer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${$auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer: "Question skipped by candidate",
          }),
        }
      );

      if (!response.ok) {
        // Continue anyway
      }

      // Store locally
      answers.push({
        question: currentQuestion.question,
        answer: "Skipped",
        skill: currentQuestion.skill,
      });

      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        userAnswer = "";
      } else {
        await completeInterview();
      }
    } catch (error) {
      // Continue anyway
      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        userAnswer = "";
      } else {
        await completeInterview();
      }
    } finally {
      loading = false;
    }
  }

  $: currentQuestion = questions[currentQuestionIndex];
  $: progress = ((currentQuestionIndex + 1) / questions.length) * 100;
</script>

<svelte:head>
  <title>Interview Session - ProofSkill AI</title>
</svelte:head>

<div
  class="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black relative overflow-hidden"
>
  {#if loading}
    <div class="flex items-center justify-center h-screen">
      <div class="flex flex-col items-center space-y-4">
        <div
          class="w-20 h-20 border-4 border-gray-600 border-t-white rounded-full animate-spin"
        ></div>
        <p class="text-gray-400">Connecting to AI...</p>
      </div>
    </div>
  {:else if questions.length > 0}
    <!-- Floating AI Orb -->
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="relative">
        <!-- Main Orb -->
        <div
          class="w-48 h-48 rounded-full bg-gradient-to-br from-slate-700 via-gray-800 to-slate-900 shadow-2xl flex items-center justify-center relative overflow-hidden border border-gray-600"
        >
          <!-- Inner Glow -->
          <div
            class="absolute inset-4 rounded-full bg-white/10 backdrop-blur-sm"
          ></div>

          <!-- AI Icon -->
          <div class="relative z-10">
            <svg
              class="w-20 h-20 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>

          <!-- Speaking Animation Waves -->
          {#if isPlaying}
            <div class="absolute inset-0 rounded-full">
              <div
                class="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping"
              ></div>
              <div
                class="absolute inset-2 rounded-full border-2 border-blue-400/20 animate-ping animation-delay-200"
              ></div>
              <div
                class="absolute inset-4 rounded-full border border-blue-400/10 animate-ping animation-delay-400"
              ></div>
            </div>
          {/if}

          <!-- Recording Animation Waves -->
          {#if isRecording}
            <div class="absolute inset-0 rounded-full">
              <div
                class="absolute inset-0 rounded-full border-4 border-red-400/50 animate-pulse"
              ></div>
              <div
                class="absolute -inset-2 rounded-full border-2 border-red-400/30 animate-ping"
              ></div>
              <div
                class="absolute -inset-4 rounded-full border border-red-400/20 animate-ping animation-delay-300"
              ></div>
            </div>
          {/if}
        </div>

        <!-- Floating Particles -->
        <div class="absolute -inset-20 pointer-events-none">
          <div
            class="absolute top-10 left-16 w-2 h-2 bg-gray-400/40 rounded-full animate-float-1"
          ></div>
          <div
            class="absolute top-32 right-12 w-1 h-1 bg-slate-400/60 rounded-full animate-float-2"
          ></div>
          <div
            class="absolute bottom-20 left-8 w-1.5 h-1.5 bg-gray-500/50 rounded-full animate-float-3"
          ></div>
          <div
            class="absolute bottom-16 right-20 w-1 h-1 bg-slate-500/40 rounded-full animate-float-1"
          ></div>
        </div>
      </div>
    </div>

    <!-- Status Text -->
    <div
      class="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-center"
    >
      <h1 class="text-2xl font-light text-white mb-2">AI Interview</h1>
      <p class="text-gray-400">
        Question {currentQuestionIndex + 1} of {questions.length}
      </p>

      {#if currentQuestion}
        <div class="mt-6 max-w-md">
          <p class="text-lg text-gray-200 font-medium mb-2">
            {currentQuestion.skill}
          </p>
          <p class="text-sm text-gray-400 leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>
      {/if}
    </div>

    <!-- Status Indicator -->
    <div
      class="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 text-center"
    >
      {#if isPlaying}
        <p class="text-blue-400 mb-2">🎤 AI is speaking...</p>
        <p class="text-gray-500 text-sm">Listen carefully</p>
      {:else if isRecording}
        <p class="text-red-400 mb-2">
          🔴 Recording ({formatTime(recordingTime)})
        </p>
        <p class="text-gray-500 text-sm">
          Speak your answer, click stop when done
        </p>
      {:else if loading}
        <p class="text-yellow-400 mb-2">⚡ Processing your answer...</p>
        <p class="text-gray-500 text-sm">Transcribing and evaluating</p>
      {:else}
        <p class="text-gray-300 mb-2">Ready for your response</p>
        <p class="text-gray-500 text-sm">
          Click the microphone to start recording
        </p>
      {/if}
    </div>

    <!-- Control Buttons -->
    <div
      class="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-4"
    >
      <!-- Record Button -->
      {#if !isPlaying && !loading}
        <button
          on:click={isRecording ? stopRecording : startRecording}
          disabled={loading}
          class="w-16 h-16 rounded-full border-2 border-gray-600 flex items-center justify-center transition-all duration-300 {isRecording
            ? 'bg-red-500 border-red-400'
            : 'bg-gray-800 hover:bg-gray-700'}"
        >
          {#if isRecording}
            <div class="w-6 h-6 bg-white rounded-sm"></div>
          {:else}
            <svg
              class="w-8 h-8 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          {/if}
        </button>
      {/if}

      <!-- Skip Button -->
      {#if !isPlaying && !isRecording && !loading}
        <button
          on:click={skipQuestion}
          disabled={loading}
          class="px-6 py-2 text-gray-400 hover:text-gray-300 text-sm border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
        >
          Skip Question
        </button>
      {/if}
    </div>

    <!-- Progress Bar -->
    <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-64">
      <div class="w-full bg-gray-800 rounded-full h-1">
        <div
          class="bg-gradient-to-r from-slate-500 to-gray-400 h-1 rounded-full transition-all duration-500"
          style="width: {((currentQuestionIndex + 1) / questions.length) *
            100}%"
        ></div>
      </div>
    </div>

    <!-- Play Audio Button (for testing) -->
    {#if !isPlaying && currentQuestion?.audio?.url}
      <button
        on:click={playQuestionAudio}
        class="absolute top-8 right-8 p-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M6.343 6.343A8 8 0 004.222 18.778m2.121-2.121A5 5 0 109.88 9.88"
          />
        </svg>
      </button>
    {/if}
  {:else}
    <div class="flex items-center justify-center h-screen">
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-4 text-white">
          No Questions Available
        </h2>
        <p class="text-gray-400 mb-6">
          This interview session doesn't have any questions.
        </p>
        <a
          href="/dashboard"
          class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >Return to Dashboard</a
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .animation-delay-200 {
    animation-delay: 200ms;
  }

  .animation-delay-300 {
    animation-delay: 300ms;
  }

  .animation-delay-400 {
    animation-delay: 400ms;
  }

  @keyframes float-1 {
    0%,
    100% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.7;
    }
    33% {
      transform: translateY(-10px) translateX(5px);
      opacity: 1;
    }
    66% {
      transform: translateY(5px) translateX(-3px);
      opacity: 0.8;
    }
  }

  @keyframes float-2 {
    0%,
    100% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.5;
    }
    50% {
      transform: translateY(-15px) translateX(-8px);
      opacity: 1;
    }
  }

  @keyframes float-3 {
    0%,
    100% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.6;
    }
    25% {
      transform: translateY(-8px) translateX(4px);
      opacity: 0.9;
    }
    75% {
      transform: translateY(8px) translateX(-6px);
      opacity: 0.7;
    }
  }

  .animate-float-1 {
    animation: float-1 4s ease-in-out infinite;
  }

  .animate-float-2 {
    animation: float-2 5s ease-in-out infinite;
  }

  .animate-float-3 {
    animation: float-3 6s ease-in-out infinite;
  }
</style>
