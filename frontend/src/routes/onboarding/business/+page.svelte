<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";

  let currentStep = 1;
  const totalSteps = 3;
  let loading = false;

  // Step 1: Company Information
  let companyData = {
    company_name: "",
    industry: "",
    company_size: "startup" as
      | "startup"
      | "small"
      | "medium"
      | "large"
      | "enterprise",
    website: "",
    description: "",
  };

  // Step 2: Hiring Needs
  let hiringData = {
    typical_roles: [] as string[],
    hiring_volume: "low" as "low" | "medium" | "high",
    budget_range: "",
    preferred_skills: [] as string[],
    remote_policy: "hybrid" as "remote" | "hybrid" | "onsite",
  };

  // Step 3: First Job Posting
  let jobData = {
    title: "",
    description: "",
    requirements: [] as string[],
    location: "",
    salary_range: "",
  };

  onMount(() => {
    // Redirect if not authenticated or not a business user
    if (!$auth.user) {
      goto("/auth/login");
      return;
    }
    if ($auth.user.role !== "business") {
      goto("/onboarding/candidate");
      return;
    }
  });

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

  function addRole(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    if (event.key === "Enter" && target.value.trim()) {
      const role = target.value.trim();
      if (!hiringData.typical_roles.includes(role)) {
        hiringData.typical_roles = [...hiringData.typical_roles, role];
      }
      target.value = "";
    }
  }

  function removeRole(role: string) {
    hiringData.typical_roles = hiringData.typical_roles.filter(
      (r) => r !== role
    );
  }

  function addSkill(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    if (event.key === "Enter" && target.value.trim()) {
      const skill = target.value.trim();
      if (!hiringData.preferred_skills.includes(skill)) {
        hiringData.preferred_skills = [...hiringData.preferred_skills, skill];
      }
      target.value = "";
    }
  }

  function removeSkill(skill: string) {
    hiringData.preferred_skills = hiringData.preferred_skills.filter(
      (s) => s !== skill
    );
  }

  function addRequirement(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    if (event.key === "Enter" && target.value.trim()) {
      const requirement = target.value.trim();
      if (!jobData.requirements.includes(requirement)) {
        jobData.requirements = [...jobData.requirements, requirement];
      }
      target.value = "";
    }
  }

  function removeRequirement(requirement: string) {
    jobData.requirements = jobData.requirements.filter(
      (r) => r !== requirement
    );
  }

  async function createFirstJob() {
    if (!jobData.title || !jobData.description) {
      toastStore.push("Please fill in the job title and description", {
        type: "error",
      });
      return;
    }

    loading = true;

    try {
      const result = await apiClient.createJob({
        title: jobData.title,
        description: jobData.description,
        skills: hiringData.preferred_skills,
        company: companyData.company_name,
        location: jobData.location,
        salary_range: jobData.salary_range,
      });

      if (result.success) {
        toastStore.push("Job posted successfully!", { type: "success" });
        goto("/dashboard");
      } else {
        toastStore.push(result.error || "Failed to create job", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Error creating job", { type: "error" });
    } finally {
      loading = false;
    }
  }

  async function skipJobCreation() {
    toastStore.push(
      "Setup complete! You can create jobs anytime from your dashboard.",
      { type: "success" }
    );
    goto("/dashboard");
  }
</script>

<svelte:head>
  <title>Business Onboarding - ProofSkill AI</title>
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
    <!-- Step 1: Company Information -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Tell Us About Your Company</h2>
        <p class="text-muted-foreground">
          Help us understand your organization better
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label
            for="company_name"
            class="block text-sm font-medium text-foreground"
          >
            Company Name *
          </label>
          <input
            id="company_name"
            type="text"
            bind:value={companyData.company_name}
            placeholder="Your Company Inc."
            class="input"
            required
          />
        </div>

        <div class="space-y-2">
          <label
            for="industry"
            class="block text-sm font-medium text-foreground"
          >
            Industry
          </label>
          <input
            id="industry"
            type="text"
            bind:value={companyData.industry}
            placeholder="Technology, Healthcare, Finance..."
            class="input"
          />
        </div>

        <div class="space-y-2">
          <label
            for="company_size"
            class="block text-sm font-medium text-foreground"
          >
            Company Size
          </label>
          <select
            id="company_size"
            bind:value={companyData.company_size}
            class="input"
          >
            <option value="startup">Startup (1-10 employees)</option>
            <option value="small">Small (11-50 employees)</option>
            <option value="medium">Medium (51-200 employees)</option>
            <option value="large">Large (201-1000 employees)</option>
            <option value="enterprise">Enterprise (1000+ employees)</option>
          </select>
        </div>

        <div class="space-y-2">
          <label
            for="website"
            class="block text-sm font-medium text-foreground"
          >
            Website
          </label>
          <input
            id="website"
            type="url"
            bind:value={companyData.website}
            placeholder="https://yourcompany.com"
            class="input"
          />
        </div>
      </div>

      <div class="space-y-2 mt-6">
        <label
          for="description"
          class="block text-sm font-medium text-foreground"
        >
          Company Description
        </label>
        <textarea
          id="description"
          bind:value={companyData.description}
          placeholder="Brief description of your company, mission, and culture..."
          class="input min-h-[100px] resize-none"
          rows="4"
        ></textarea>
      </div>

      <div class="flex justify-end mt-8">
        <button
          on:click={nextStep}
          disabled={!companyData.company_name}
          class="btn btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  {:else if currentStep === 2}
    <!-- Step 2: Hiring Needs -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Your Hiring Needs</h2>
        <p class="text-muted-foreground">Let us know what you're looking for</p>
      </div>

      <div class="space-y-6">
        <!-- Typical Roles -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">
            What roles do you typically hire for?
          </label>
          <input
            type="text"
            placeholder="Type a role and press Enter (e.g., Software Engineer)"
            class="input"
            on:keydown={addRole}
          />
          {#if hiringData.typical_roles.length > 0}
            <div class="flex flex-wrap gap-2 mt-3">
              {#each hiringData.typical_roles as role}
                <span
                  class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center"
                >
                  {role}
                  <button
                    on:click={() => removeRole(role)}
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
          {/if}
        </div>

        <!-- Hiring Volume & Budget -->
        <div class="grid md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label
              for="hiring_volume"
              class="block text-sm font-medium text-foreground"
            >
              Hiring Volume
            </label>
            <select
              id="hiring_volume"
              bind:value={hiringData.hiring_volume}
              class="input"
            >
              <option value="low">Low (1-5 hires/year)</option>
              <option value="medium">Medium (6-20 hires/year)</option>
              <option value="high">High (20+ hires/year)</option>
            </select>
          </div>

          <div class="space-y-2">
            <label
              for="budget_range"
              class="block text-sm font-medium text-foreground"
            >
              Typical Budget Range
            </label>
            <input
              id="budget_range"
              type="text"
              bind:value={hiringData.budget_range}
              placeholder="e.g., $60k-$120k"
              class="input"
            />
          </div>
        </div>

        <!-- Preferred Skills -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">
            Key skills you look for
          </label>
          <input
            type="text"
            placeholder="Type a skill and press Enter (e.g., React, Python)"
            class="input"
            on:keydown={addSkill}
          />
          {#if hiringData.preferred_skills.length > 0}
            <div class="flex flex-wrap gap-2 mt-3">
              {#each hiringData.preferred_skills as skill}
                <span
                  class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center"
                >
                  {skill}
                  <button
                    on:click={() => removeSkill(skill)}
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
          {/if}
        </div>

        <!-- Remote Policy -->
        <div class="space-y-2">
          <label
            for="remote_policy"
            class="block text-sm font-medium text-foreground"
          >
            Work Policy
          </label>
          <select
            id="remote_policy"
            bind:value={hiringData.remote_policy}
            class="input"
          >
            <option value="remote">Fully Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site Only</option>
          </select>
        </div>
      </div>

      <div class="flex justify-between mt-8">
        <button on:click={prevStep} class="btn btn-outline"> Back </button>
        <button on:click={nextStep} class="btn btn-primary"> Continue </button>
      </div>
    </div>
  {:else if currentStep === 3}
    <!-- Step 3: First Job Posting -->
    <div class="card p-8">
      <div class="text-center mb-8">
        <h2 class="text-xl font-semibold mb-2">Create Your First Job</h2>
        <p class="text-muted-foreground">
          Optional: Post a job to start finding candidates
        </p>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <label
            for="job_title"
            class="block text-sm font-medium text-foreground"
          >
            Job Title
          </label>
          <input
            id="job_title"
            type="text"
            bind:value={jobData.title}
            placeholder="Senior Software Engineer"
            class="input"
          />
        </div>

        <div class="space-y-2">
          <label
            for="job_description"
            class="block text-sm font-medium text-foreground"
          >
            Job Description
          </label>
          <textarea
            id="job_description"
            bind:value={jobData.description}
            placeholder="Describe the role, responsibilities, and what makes this opportunity great..."
            class="input min-h-[120px] resize-none"
            rows="5"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-foreground mb-2">
            Requirements
          </label>
          <input
            type="text"
            placeholder="Type a requirement and press Enter"
            class="input"
            on:keydown={addRequirement}
          />
          {#if jobData.requirements.length > 0}
            <div class="space-y-2 mt-3">
              {#each jobData.requirements as requirement}
                <div
                  class="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <span class="text-sm">{requirement}</span>
                  <button
                    on:click={() => removeRequirement(requirement)}
                    class="text-muted-foreground hover:text-destructive"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label
              for="job_location"
              class="block text-sm font-medium text-foreground"
            >
              Location
            </label>
            <input
              id="job_location"
              type="text"
              bind:value={jobData.location}
              placeholder="San Francisco, CA or Remote"
              class="input"
            />
          </div>

          <div class="space-y-2">
            <label
              for="job_salary"
              class="block text-sm font-medium text-foreground"
            >
              Salary Range
            </label>
            <input
              id="job_salary"
              type="text"
              bind:value={jobData.salary_range}
              placeholder="$120k-$160k"
              class="input"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-between mt-8">
        <button on:click={prevStep} class="btn btn-outline"> Back </button>
        <div class="space-x-3">
          <button on:click={skipJobCreation} class="btn btn-outline">
            Skip for Now
          </button>
          <button
            on:click={createFirstJob}
            disabled={loading || !jobData.title || !jobData.description}
            class="btn btn-primary"
          >
            {#if loading}
              <div class="spinner h-4 w-4"></div>
              Creating...
            {:else}
              Create Job
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
