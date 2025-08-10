<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";

  let jobs: any[] = [];
  let loading = true;
  let searchTerm = "";
  let selectedSkills: string[] = [];
  let availableSkills = [
    "JavaScript",
    "Python",
    "React",
    "Node.js",
    "TypeScript",
    "SQL",
    "AWS",
    "Docker",
  ];

  onMount(async () => {
    if (!$auth.user) {
      goto("/auth/login");
      return;
    }
    await loadJobs();
  });

  async function loadJobs() {
    try {
      const response = await fetch("/v1/api/jobs", {
        headers: {
          Authorization: `Bearer ${$auth.token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        jobs = result.jobs || [];
      } else {
        toastStore.push("Failed to load jobs", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error loading jobs", { type: "error" });
    } finally {
      loading = false;
    }
  }

  async function applyToJob(jobId: string) {
    try {
      const response = await fetch(`/v1/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${$auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ application: true }),
      });

      if (response.ok) {
        toastStore.push("Application submitted successfully!", {
          type: "success",
        });
      } else {
        toastStore.push("Failed to apply", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error submitting application", { type: "error" });
    }
  }

  function toggleSkillFilter(skill: string) {
    if (selectedSkills.includes(skill)) {
      selectedSkills = selectedSkills.filter((s) => s !== skill);
    } else {
      selectedSkills = [...selectedSkills, skill];
    }
  }

  $: filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSkills =
      selectedSkills.length === 0 ||
      selectedSkills.some((skill) =>
        job.description.toLowerCase().includes(skill.toLowerCase())
      );
    return matchesSearch && matchesSkills;
  });
</script>

<svelte:head>
  <title>Jobs - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 py-8">
  <div class="max-w-6xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Available Jobs</h1>
      <p class="text-gray-400">Find your next opportunity</p>
    </div>

    <!-- Filters -->
    <div class="bg-gray-800 rounded-lg p-6 mb-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2"
            >Search Jobs</label
          >
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Search by title or description..."
            class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Skills Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2"
            >Filter by Skills</label
          >
          <div class="flex flex-wrap gap-2">
            {#each availableSkills as skill}
              <button
                on:click={() => toggleSkillFilter(skill)}
                class="px-3 py-1 text-sm rounded-full border transition-colors {selectedSkills.includes(
                  skill
                )
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}"
              >
                {skill}
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if selectedSkills.length > 0}
        <div class="mt-4 flex items-center gap-2">
          <span class="text-sm text-gray-400">Active filters:</span>
          {#each selectedSkills as skill}
            <span class="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
              {skill}
              <button
                on:click={() => toggleSkillFilter(skill)}
                class="ml-1 hover:text-gray-300">×</button
              >
            </span>
          {/each}
          <button
            on:click={() => (selectedSkills = [])}
            class="text-xs text-blue-400 hover:text-blue-300">Clear all</button
          >
        </div>
      {/if}
    </div>

    <!-- Jobs List -->
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div
          class="w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>
    {:else if filteredJobs.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-lg mb-4">No jobs found</div>
        <p class="text-gray-500">Try adjusting your search criteria</p>
      </div>
    {:else}
      <div class="grid gap-6">
        {#each filteredJobs as job}
          <div
            class="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="text-xl font-semibold text-white mb-2">
                  {job.title}
                </h3>
                <p class="text-gray-400 text-sm mb-2">
                  {job.region || "Remote"}
                </p>
                <p class="text-gray-300 leading-relaxed">{job.description}</p>
              </div>
              <div class="text-right">
                <p class="text-gray-400 text-sm mb-3">
                  Posted {new Date(job.created_at).toLocaleDateString()}
                </p>
                {#if $auth.user?.role === "candidate"}
                  <button
                    on:click={() => applyToJob(job.id)}
                    class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Apply Now
                  </button>
                {:else}
                  <a
                    href="/jobs/{job.id}"
                    class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors inline-block"
                  >
                    View Details
                  </a>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Action Buttons -->
    {#if $auth.user?.role === "business"}
      <div class="mt-8 text-center">
        <a
          href="/jobs/create"
          class="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Post New Job
        </a>
      </div>
    {/if}
  </div>
</div>
