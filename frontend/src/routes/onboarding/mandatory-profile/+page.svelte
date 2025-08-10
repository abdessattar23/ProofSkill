<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { apiClient } from "$lib/api/client";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  let currentStep = 1;
  let loading = false;
  let uploadedFile: File | null = null;
  let isDragOver = false;
  let cvParsingResult: any = null;
  let parsedSkills: string[] = [];
  let selectedSkills: string[] = [];
  let interviewStarted = false;

  onMount(() => {
    // Redirect if user is not first-time candidate
    if (
      $auth.user &&
      (!$auth.user.first_time || $auth.user.role !== "candidate")
    ) {
      goto("/dashboard");
    }
  });

  // Reactive redirect check
  $: if (
    $auth.user &&
    (!$auth.user.first_time || $auth.user.role !== "candidate")
  ) {
    goto("/dashboard");
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      uploadedFile = target.files[0];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      uploadedFile = event.dataTransfer.files[0];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  async function uploadAndParseCV() {
    if (!uploadedFile) {
      toastStore.push("Please select a CV file first", { type: "error" });
      return;
    }

    loading = true;

    try {
      const response = await apiClient.parseCV(uploadedFile);
      console.log("Full API Response:", response);

      if (response.success && response.data) {
        // Handle double nesting: response.data is the backend response which has its own data property
        const backendResponse = response.data;
        cvParsingResult = backendResponse.data || backendResponse; // Use backendResponse.data if it exists, otherwise use backendResponse
        console.log("CV Parsing Result:", cvParsingResult);
        console.log("Name:", cvParsingResult.name);
        console.log("Email:", cvParsingResult.email);
        console.log("Skills:", cvParsingResult.skills);

        parsedSkills = cvParsingResult.skills || [];
        selectedSkills = [...parsedSkills].slice(0, 20); // Pre-select parsed skills but limit to 20

        toastStore.push("CV parsed successfully!", { type: "success" });
        currentStep = 2;
      } else {
        console.error("API Error:", response);
        toastStore.push(response.error || "Failed to parse CV", {
          type: "error",
        });
      }
    } catch (error) {
      console.error("Network Error:", error);
      toastStore.push("Network error while parsing CV", { type: "error" });
    } finally {
      loading = false;
    }
  }

  function toggleSkill(skill: string) {
    if (selectedSkills.includes(skill)) {
      selectedSkills = selectedSkills.filter((s) => s !== skill);
    } else {
      if (selectedSkills.length >= 20) {
        toastStore.push("You can select maximum 20 skills", {
          type: "warning",
        });
        return;
      }
      selectedSkills = [...selectedSkills, skill];
    }
  }

  async function completeProfileAndStartInterview() {
    if (selectedSkills.length === 0) {
      toastStore.push("Please select at least one skill", { type: "error" });
      return;
    }

    loading = true;

    try {
      // Import candidate data from CV
      const importResponse = await apiClient.importCandidate({
        name: cvParsingResult.name || $auth.user?.name || "Unknown",
        email: cvParsingResult.email || $auth.user?.email || "",
        phone: cvParsingResult.phone || "",
        skills: selectedSkills,
        experience: cvParsingResult.experience || [],
        education: cvParsingResult.education || [],
        certifications: cvParsingResult.certifications || [],
      });

      if (importResponse.success) {
        // Update user to mark first_time as false
        auth.update((state) => ({
          ...state,
          user: state.user ? { ...state.user, first_time: false } : null,
        }));

        toastStore.push("Profile completed successfully!", { type: "success" });
        currentStep = 3;

        // Auto-start interview based on CV skills
        await startInterview();
      } else {
        toastStore.push(importResponse.error || "Failed to complete profile", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Network error while completing profile", {
        type: "error",
      });
    } finally {
      loading = false;
    }
  }

  async function startInterview() {
    try {
      // Create interview session based on selected skills
      const sessionResponse = await apiClient.createAdvancedInterviewSession({
        candidateId: $auth.user?.id || "",
        interviewType: "technical",
        difficulty: "intermediate",
        skillsToAssess: selectedSkills,
        estimatedDuration: 1800, // 30 minutes in seconds
      });

      if (sessionResponse.success && sessionResponse.data?.sessionId) {
        interviewStarted = true;
        toastStore.push("Interview starting...", { type: "success" });

        // Redirect to interview page
        setTimeout(() => {
          goto(`/interview/session/${sessionResponse.data.sessionId}`);
        }, 2000);
      } else {
        toastStore.push("Failed to start interview", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error starting interview", { type: "error" });
    }
  }

  $: canProceedToStep2 = uploadedFile && cvParsingResult;
  $: canCompleteProfile = selectedSkills.length > 0;
</script>

<svelte:head>
  <title>Complete Your Profile - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen bg-background">
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold mb-2">Complete Your Profile</h1>
      <p class="text-muted-foreground">
        As a first-time user, please upload your CV to set up your profile and
        start your skill assessment.
      </p>
    </div>

    <!-- Progress Steps -->
    <div class="flex justify-center mb-8">
      <div class="flex items-center space-x-4">
        <div class="flex items-center">
          <div
            class="w-8 h-8 rounded-full {currentStep >= 1
              ? 'bg-brand text-white'
              : 'bg-surface text-muted-foreground'} flex items-center justify-center text-sm font-medium"
          >
            1
          </div>
          <span
            class="ml-2 text-sm {currentStep >= 1
              ? 'text-foreground'
              : 'text-muted-foreground'}">Upload CV</span
          >
        </div>
        <div
          class="w-8 h-px {currentStep >= 2 ? 'bg-brand' : 'bg-border'}"
        ></div>
        <div class="flex items-center">
          <div
            class="w-8 h-8 rounded-full {currentStep >= 2
              ? 'bg-brand text-white'
              : 'bg-surface text-muted-foreground'} flex items-center justify-center text-sm font-medium"
          >
            2
          </div>
          <span
            class="ml-2 text-sm {currentStep >= 2
              ? 'text-foreground'
              : 'text-muted-foreground'}">Review Skills</span
          >
        </div>
        <div
          class="w-8 h-px {currentStep >= 3 ? 'bg-brand' : 'bg-border'}"
        ></div>
        <div class="flex items-center">
          <div
            class="w-8 h-8 rounded-full {currentStep >= 3
              ? 'bg-brand text-white'
              : 'bg-surface text-muted-foreground'} flex items-center justify-center text-sm font-medium"
          >
            3
          </div>
          <span
            class="ml-2 text-sm {currentStep >= 3
              ? 'text-foreground'
              : 'text-muted-foreground'}">Start Interview</span
          >
        </div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="max-w-2xl mx-auto">
      {#if currentStep === 1}
        <!-- Step 1: CV Upload -->
        <div class="card p-8">
          <h2 class="text-xl font-semibold mb-4">Upload Your CV</h2>
          <p class="text-muted-foreground mb-6">
            Upload your CV to automatically extract your skills and experience.
            This will help us create personalized interview questions.
          </p>

          <!-- File Upload Area -->
          <div
            class="border-2 border-dashed {isDragOver
              ? 'border-brand bg-brand/5'
              : 'border-border'} rounded-lg p-8 text-center transition-colors"
            on:drop={handleDrop}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
          >
            {#if uploadedFile}
              <div class="flex items-center justify-center space-x-3 mb-4">
                <svg
                  class="h-8 w-8 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
                <div>
                  <p class="font-medium">{uploadedFile.name}</p>
                  <p class="text-sm text-muted-foreground">
                    {Math.round(uploadedFile.size / 1024)} KB
                  </p>
                </div>
              </div>
            {:else}
              <svg
                class="h-12 w-12 text-muted-foreground mx-auto mb-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <p class="text-lg font-medium mb-2">
                Drop your CV here or click to browse
              </p>
              <p class="text-sm text-muted-foreground mb-4">
                Supports PDF, DOC, DOCX files up to 10MB
              </p>
            {/if}

            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              on:change={handleFileSelect}
              class="hidden"
              id="cv-upload"
            />
            <label for="cv-upload" class="btn btn-outline cursor-pointer">
              {uploadedFile ? "Change File" : "Choose File"}
            </label>
          </div>

          {#if uploadedFile}
            <div class="mt-6 flex justify-end">
              <button
                on:click={uploadAndParseCV}
                disabled={loading}
                class="btn btn-primary"
              >
                {#if loading}
                  <div class="spinner h-4 w-4 mr-2"></div>
                  Parsing CV...
                {:else}
                  Parse CV & Continue
                {/if}
              </button>
            </div>
          {/if}
        </div>
      {:else if currentStep === 2}
        <!-- Step 2: Skills Review -->
        <div class="card p-8">
          <h2 class="text-xl font-semibold mb-4">Review Your Skills</h2>
          <p class="text-muted-foreground mb-6">
            We've extracted these skills from your CV. Select the ones you'd
            like to be assessed on.
          </p>

          {#if cvParsingResult}
            <!-- Parsed Information Summary -->
            <div class="bg-surface p-4 rounded-lg mb-6">
              <h3 class="font-medium mb-3">Extracted Information:</h3>
              <div class="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">Name:</span>
                  <span class="ml-2"
                    >{cvParsingResult.name || "Not specified"}</span
                  >
                </div>
                <div>
                  <span class="text-muted-foreground">Email:</span>
                  <span class="ml-2"
                    >{cvParsingResult.email || "Not specified"}</span
                  >
                </div>
                {#if cvParsingResult.phone}
                  <div>
                    <span class="text-muted-foreground">Phone:</span>
                    <span class="ml-2">{cvParsingResult.phone}</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Skills Selection -->
            {#if parsedSkills.length > 0}
              <div class="mb-6">
                <div class="flex justify-between items-center mb-3">
                  <h3 class="font-medium">Select Skills for Assessment:</h3>
                  <span class="text-sm text-muted-foreground">
                    {selectedSkills.length}/20 selected
                  </span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {#each parsedSkills as skill}
                    <label
                      class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors {selectedSkills.includes(
                        skill
                      )
                        ? 'border-brand bg-brand/5'
                        : 'border-border hover:border-brand/50'}"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkills.includes(skill)}
                        on:change={() => toggleSkill(skill)}
                        class="rounded border-input-border"
                      />
                      <span class="text-sm">{skill}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="text-center py-8">
                <p class="text-muted-foreground">
                  No skills were automatically detected from your CV.
                </p>
                <p class="text-sm text-muted-foreground mt-2">
                  You can add skills manually in your profile later.
                </p>
              </div>
            {/if}

            <div class="flex justify-between">
              <button
                on:click={() => (currentStep = 1)}
                class="btn btn-outline"
              >
                Back to Upload
              </button>
              <button
                on:click={completeProfileAndStartInterview}
                disabled={loading || !canCompleteProfile}
                class="btn btn-primary"
              >
                {#if loading}
                  <div class="spinner h-4 w-4 mr-2"></div>
                  Setting up Profile...
                {:else}
                  Complete Profile & Start Interview
                {/if}
              </button>
            </div>
          {/if}
        </div>
      {:else if currentStep === 3}
        <!-- Step 3: Interview Starting -->
        <div class="card p-8 text-center">
          <div
            class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg
              class="h-8 w-8 text-success"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 class="text-2xl font-semibold mb-4">Profile Complete!</h2>
          <p class="text-muted-foreground mb-6">
            Your profile has been set up successfully. We're now preparing your
            personalized interview based on your skills and experience.
          </p>

          <div class="bg-surface p-4 rounded-lg mb-6">
            <h3 class="font-medium mb-2">Interview Details:</h3>
            <div class="text-sm text-muted-foreground space-y-1">
              <p>Skills: {selectedSkills.join(", ")}</p>
              <p>Duration: ~30 minutes</p>
              <p>Type: AI-powered skill assessment</p>
            </div>
          </div>

          {#if interviewStarted}
            <div class="flex items-center justify-center space-x-3 text-brand">
              <div class="spinner h-5 w-5"></div>
              <span>Starting your interview...</span>
            </div>
          {:else}
            <button on:click={startInterview} class="btn btn-primary">
              Start Interview Now
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
