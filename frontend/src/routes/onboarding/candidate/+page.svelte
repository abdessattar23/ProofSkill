<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";

  let currentStep = 1;
  const totalSteps = 3;
  let loading = false;

  // Step 1: CV Upload
  let cvFile: File | null = null;
  let dragActive = false;
  let cvParseResult: any = null;

  // Step 2: Skills Review
  let extractedSkills: string[] = [];
  let selectedSkills: string[] = [];

  // Step 3: Profile Setup
  let profileData = {
    phone: "",
    location: "",
    experience_level: "intermediate" as
      | "junior"
      | "intermediate"
      | "senior"
      | "expert",
    preferred_roles: [] as string[],
    availability: "open" as "open" | "passive" | "not_looking",
  };

  onMount(() => {
    // Redirect if not authenticated or not a candidate
    if (!$auth.user) {
      goto("/auth/login");
      return;
    }
    if ($auth.user.role !== "candidate") {
      goto("/onboarding/business");
      return;
    }
  });

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      cvFile = target.files[0];
    }
  }

  function handleFileDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      cvFile = event.dataTransfer.files[0];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragActive = true;
  }

  function handleDragLeave() {
    dragActive = false;
  }

  async function parseCV() {
    if (!cvFile) {
      toastStore.push("Please select a CV file first", { type: "error" });
      return;
    }

    loading = true;

    try {
      const result = await apiClient.parseCV(cvFile);

      if (result.success && result.data) {
        cvParseResult = result.data;
        extractedSkills = result.data.skills || [];
        selectedSkills = [...extractedSkills];
        toastStore.push("CV parsed successfully!", { type: "success" });
        currentStep = 2;
      } else {
        toastStore.push(result.error || "Failed to parse CV", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Error parsing CV", { type: "error" });
    } finally {
      loading = false;
    }
  }

  function toggleSkill(skill: string) {
    if (selectedSkills.includes(skill)) {
      selectedSkills = selectedSkills.filter((s) => s !== skill);
    } else {
      selectedSkills = [...selectedSkills, skill];
    }
  }

  function addCustomSkill(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    if (event.key === "Enter" && target.value.trim()) {
      const skill = target.value.trim();
      if (!selectedSkills.includes(skill)) {
        selectedSkills = [...selectedSkills, skill];
      }
      target.value = "";
    }
  }

  async function completeOnboarding() {
    loading = true;

    try {
      // Import candidate data
      const candidateData = {
        name: $auth.user?.name || "",
        email: $auth.user?.email || "",
        phone: profileData.phone,
        skills: selectedSkills,
        experience: cvParseResult?.experience || [],
        raw_cv_text: cvParseResult ? JSON.stringify(cvParseResult) : "",
      };

      const result = await apiClient.importCandidate(candidateData);

      if (result.success) {
        toastStore.push("Profile setup complete!", { type: "success" });
        goto("/dashboard");
      } else {
        toastStore.push(result.error || "Failed to complete setup", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Error completing setup", { type: "error" });
    } finally {
      loading = false;
    }
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }
</script>

<svelte:head>
  <title>Candidate Onboarding - ProofSkill AI</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <!-- Progress Bar -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Welcome to ProofSkill AI</h1>
      <span class="text-sm text-muted-foreground"
        >Step {currentStep} of {totalSteps}</span
      >
    </div>
    <div class="w-full bg-muted rounded-full h-2">
      <div
        class="bg-primary h-2 rounded-full transition-all duration-300"
        style="width: {(currentStep / totalSteps) * 100}%"
      ></div>
    </div>
  </div>

  {#if currentStep === 1}
    <!-- Step 1: CV Upload -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Upload Your CV</h2>
        <p class="text-muted-foreground">
          Let our AI analyze your skills and experience
        </p>
      </div>

      <div class="max-w-md mx-auto">
        <!-- File Upload Area -->
        <div
          class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'}"
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          on:drop={handleFileDrop}
        >
          {#if cvFile}
            <div class="flex items-center justify-center space-x-3 mb-4">
              <svg
                class="w-8 h-8 text-success"
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
                <p class="font-medium">{cvFile.name}</p>
                <p class="text-sm text-muted-foreground">
                  {(cvFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
          {:else}
            <svg
              class="w-12 h-12 text-muted-foreground mx-auto mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <p class="text-muted-foreground mb-2">
              Drag & drop your CV here, or click to browse
            </p>
            <p class="text-xs text-muted-foreground">
              Supports PDF, DOC, DOCX, TXT files up to 10MB
            </p>
          {/if}

          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            on:change={handleFileSelect}
            class="hidden"
            id="cv-upload"
          />
          <label for="cv-upload" class="btn btn-outline mt-4 cursor-pointer">
            {cvFile ? "Choose Different File" : "Browse Files"}
          </label>
        </div>

        <button
          on:click={parseCV}
          disabled={!cvFile || loading}
          class="btn btn-primary w-full mt-6"
        >
          {#if loading}
            <div class="spinner h-4 w-4"></div>
            Analyzing CV...
          {:else}
            Continue
          {/if}
        </button>
      </div>
    </div>
  {:else if currentStep === 2}
    <!-- Step 2: Skills Review -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Review Your Skills</h2>
        <p class="text-muted-foreground">Confirm and add to your skill list</p>
      </div>

      <div class="space-y-6">
        <!-- Extracted Skills -->
        {#if extractedSkills.length > 0}
          <div>
            <h3 class="font-medium mb-3">Skills found in your CV:</h3>
            <div class="flex flex-wrap gap-2">
              {#each extractedSkills as skill}
                <button
                  on:click={() => toggleSkill(skill)}
                  class="px-3 py-1 rounded-full text-sm transition-colors {selectedSkills.includes(
                    skill
                  )
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                >
                  {skill}
                  {#if selectedSkills.includes(skill)}
                    <svg
                      class="w-3 h-3 inline ml-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Add Custom Skills -->
        <div>
          <h3 class="font-medium mb-3">Add additional skills:</h3>
          <input
            type="text"
            placeholder="Type a skill and press Enter"
            class="input"
            on:keydown={addCustomSkill}
          />
        </div>

        <!-- Selected Skills Summary -->
        {#if selectedSkills.length > 0}
          <div>
            <h3 class="font-medium mb-3">
              Selected skills ({selectedSkills.length}):
            </h3>
            <div class="flex flex-wrap gap-2">
              {#each selectedSkills as skill}
                <span
                  class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center"
                >
                  {skill}
                  <button
                    on:click={() => toggleSkill(skill)}
                    class="ml-2 text-primary/60 hover:text-primary"
                  >
                    <svg
                      class="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-between mt-8">
        <button on:click={prevStep} class="btn btn-outline"> Back </button>
        <button
          on:click={nextStep}
          disabled={selectedSkills.length === 0}
          class="btn btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  {:else if currentStep === 3}
    <!-- Step 3: Profile Setup -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Complete Your Profile</h2>
        <p class="text-muted-foreground">
          Help us match you with the right opportunities
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label for="phone" class="block text-sm font-medium text-foreground">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            bind:value={profileData.phone}
            placeholder="+1 (555) 000-0000"
            class="input"
          />
        </div>

        <div class="space-y-2">
          <label
            for="location"
            class="block text-sm font-medium text-foreground"
          >
            Location
          </label>
          <input
            id="location"
            type="text"
            bind:value={profileData.location}
            placeholder="City, Country"
            class="input"
          />
        </div>

        <div class="space-y-2">
          <label
            for="experience"
            class="block text-sm font-medium text-foreground"
          >
            Experience Level
          </label>
          <select
            id="experience"
            bind:value={profileData.experience_level}
            class="input"
          >
            <option value="junior">Junior (0-2 years)</option>
            <option value="intermediate">Intermediate (3-5 years)</option>
            <option value="senior">Senior (6-10 years)</option>
            <option value="expert">Expert (10+ years)</option>
          </select>
        </div>

        <div class="space-y-2">
          <label
            for="availability"
            class="block text-sm font-medium text-foreground"
          >
            Job Search Status
          </label>
          <select
            id="availability"
            bind:value={profileData.availability}
            class="input"
          >
            <option value="open">Actively looking</option>
            <option value="passive">Open to opportunities</option>
            <option value="not_looking">Not looking</option>
          </select>
        </div>
      </div>

      <div class="flex justify-between mt-8">
        <button on:click={prevStep} class="btn btn-outline"> Back </button>
        <button
          on:click={completeOnboarding}
          disabled={loading}
          class="btn btn-primary"
        >
          {#if loading}
            <div class="spinner h-4 w-4"></div>
            Setting up...
          {:else}
            Complete Setup
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>
