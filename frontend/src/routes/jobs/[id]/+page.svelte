<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";

  const jobId = $page.params.id;
  let job: any = null;
  let loading = true;
  let applying = false;
  let candidates: any[] = [];
  let loadingCandidates = false;

  onMount(async () => {
    if (!$auth.user) {
      goto("/auth/login");
      return;
    }
    await loadJob();
    if ($auth.user.role === "business") {
      await loadCandidates();
    }
  });

  async function loadJob() {
    try {
      const response = await fetch(`/v1/api/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${$auth.token}`,
        },
      });

      if (response.ok) {
        job = await response.json();
      } else {
        toastStore.push("Job not found", { type: "error" });
        goto("/jobs");
      }
    } catch (error) {
      toastStore.push("Error loading job", { type: "error" });
      goto("/jobs");
    } finally {
      loading = false;
    }
  }

  async function loadCandidates() {
    loadingCandidates = true;
    try {
      const response = await fetch(`/v1/api/jobs/${jobId}/candidates`, {
        headers: {
          Authorization: `Bearer ${$auth.token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        candidates = result.candidates || [];
      }
    } catch (error) {
      console.error("Error loading candidates:", error);
    } finally {
      loadingCandidates = false;
    }
  }

  async function applyToJob() {
    applying = true;

    try {
      const response = await fetch(`/v1/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${$auth.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        toastStore.push("Application submitted successfully!", {
          type: "success",
        });
        // Optionally redirect to a confirmation page or update UI
      } else if (response.status === 409) {
        toastStore.push("You have already applied to this job", {
          type: "info",
        });
      } else {
        toastStore.push("Failed to apply", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error submitting application", { type: "error" });
    } finally {
      applying = false;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
</script>

<svelte:head>
  <title>{job ? job.title : "Job Details"} - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 py-8">
  <div class="max-w-4xl mx-auto px-4">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div
          class="w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>
    {:else if job}
      <!-- Back Button -->
      <div class="mb-6">
        <a
          href="/jobs"
          class="inline-flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <svg
            class="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Jobs
        </a>
      </div>

      <!-- Job Header -->
      <div class="bg-gray-800 rounded-lg p-8 mb-8">
        <div class="flex justify-between items-start mb-6">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">{job.title}</h1>
            <div class="flex items-center gap-4 text-gray-400 mb-4">
              <div class="flex items-center gap-1">
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {job.region || "Remote"}
              </div>
              <div class="flex items-center gap-1">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Posted {formatDate(job.created_at)}
              </div>
              {#if job.salary_range}
                <div class="flex items-center gap-1">
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                  {job.salary_range}
                </div>
              {/if}
            </div>
          </div>

          {#if $auth.user?.role === "candidate"}
            <button
              on:click={applyToJob}
              disabled={applying}
              class="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center"
            >
              {#if applying}
                <div
                  class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
                ></div>
              {/if}
              {applying ? "Applying..." : "Apply Now"}
            </button>
          {/if}
        </div>

        <!-- Job Description -->
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-white mb-3">Job Description</h2>
          <div class="text-gray-300 leading-relaxed whitespace-pre-line">
            {job.description}
          </div>
        </div>

        <!-- Required Skills -->
        {#if job.skills && job.skills.length > 0}
          <div class="mb-6">
            <h2 class="text-xl font-semibold text-white mb-3">
              Required Skills
            </h2>
            <div class="flex flex-wrap gap-2">
              {#each job.skills as skill}
                <span
                  class="px-3 py-1 bg-blue-600 text-white rounded-full text-sm"
                >
                  {skill}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Job Details -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#if job.experience_level}
            <div>
              <h3 class="text-sm font-medium text-gray-400 mb-1">
                Experience Level
              </h3>
              <p class="text-white capitalize">{job.experience_level}</p>
            </div>
          {/if}
          {#if job.job_type}
            <div>
              <h3 class="text-sm font-medium text-gray-400 mb-1">Job Type</h3>
              <p class="text-white capitalize">
                {job.job_type.replace("-", " ")}
              </p>
            </div>
          {/if}
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-1">Applications</h3>
            <p class="text-white">
              {job.applications_count || 0} candidates applied
            </p>
          </div>
        </div>
      </div>

      <!-- Candidates Section (Business View) -->
      {#if $auth.user?.role === "business"}
        <div class="bg-gray-800 rounded-lg p-8">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-semibold text-white">Candidates</h2>
            <div class="text-gray-400">{candidates.length} applications</div>
          </div>

          {#if loadingCandidates}
            <div class="flex items-center justify-center py-8">
              <div
                class="w-6 h-6 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"
              ></div>
            </div>
          {:else if candidates.length === 0}
            <div class="text-center py-8">
              <div class="text-gray-400 mb-2">No applications yet</div>
              <p class="text-gray-500 text-sm">
                Share your job posting to attract candidates
              </p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each candidates as candidate}
                <div
                  class="bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <h3 class="text-white font-medium">{candidate.name}</h3>
                    <p class="text-gray-400 text-sm">{candidate.email}</p>
                    <p class="text-gray-400 text-xs mt-1">
                      Applied {formatDate(candidate.applied_at)}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <a
                      href="/candidates/{candidate.id}"
                      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      View Profile
                    </a>
                    <button
                      class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Interview
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-400 text-lg mb-4">Job not found</div>
        <a href="/jobs" class="text-blue-400 hover:text-blue-300"
          >Back to Jobs</a
        >
      </div>
    {/if}
  </div>
</div>
