<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";
  import { apiClient } from "$lib/api/client";

  let jobs: any[] = [];
  let loading = true;
  let deletingId: string | null = null;
  let selectedJob: any = null;
  let showApplicationsModal = false;
  let showMatchesModal = false;
  let applications: any[] = [];
  let matches: any[] = [];
  let loadingApplications = false;
  let loadingMatches = false;

  onMount(async () => {
    if (!$auth.user || $auth.user.role !== "business") {
      goto("/dashboard");
      return;
    }
    await loadJobs();
  });

  async function loadJobs() {
    try {
      const response = await apiClient.getMyJobs();
      if (response.success && response.data) {
        jobs = response.data.jobs || [];
      } else {
        toastStore.push("Failed to load jobs", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error loading jobs", { type: "error" });
    } finally {
      loading = false;
    }
  }

  async function viewApplications(job: any) {
    selectedJob = job;
    showApplicationsModal = true;
    loadingApplications = true;
    applications = [];

    try {
      const response = await apiClient.getJobApplications(job.id);
      if (response.success && response.data) {
        applications = response.data.applications || [];
      } else {
        toastStore.push("Failed to load applications", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error loading applications", { type: "error" });
    } finally {
      loadingApplications = false;
    }
  }

  async function viewMatches(job: any) {
    selectedJob = job;
    showMatchesModal = true;
    loadingMatches = true;
    matches = [];

    try {
      const response = await apiClient.getJobMatches(job.id, {
        minSimilarity: 0.3,
      });
      if (response.success) {
        // Handle both response formats: direct matches or nested in data
        matches = response.data?.matches || response.data?.data || (response as any).matches || [];
      } else {
        toastStore.push("Failed to load matches", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error loading matches", { type: "error" });
    } finally {
      loadingMatches = false;
    }
  }

  async function updateApplicationStatus(
    applicationId: string,
    status: string
  ) {
    try {
      const response = await apiClient.updateApplicationStatus(
        selectedJob.id,
        applicationId,
        { status }
      );
      if (response.success) {
        // Refresh applications
        await viewApplications(selectedJob);
        toastStore.push("Application status updated", { type: "success" });
      } else {
        toastStore.push("Failed to update application status", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Error updating application status", { type: "error" });
    }
  }

  function closeModals() {
    showApplicationsModal = false;
    showMatchesModal = false;
    selectedJob = null;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function deleteJob(jobId: string) {
    if (
      !confirm(
        "Are you sure you want to delete this job? This action cannot be undone."
      )
    ) {
      return;
    }

    deletingId = jobId;

    try {
      const response = await fetch(`/v1/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${$auth.token}`,
        },
      });

      if (response.ok) {
        jobs = jobs.filter((job) => job.id !== jobId);
        toastStore.push("Job deleted successfully", { type: "success" });
      } else {
        toastStore.push("Failed to delete job", { type: "error" });
      }
    } catch (error) {
      toastStore.push("Error deleting job", { type: "error" });
    } finally {
      deletingId = null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active":
        return "bg-green-600";
      case "paused":
        return "bg-yellow-600";
      case "closed":
        return "bg-gray-600";
      default:
        return "bg-blue-600";
    }
  }
</script>

<svelte:head>
  <title>Manage Jobs - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 py-8">
  <div class="max-w-6xl mx-auto px-4">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">Manage Jobs</h1>
        <p class="text-gray-400">View and manage your job postings</p>
      </div>
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

    <!-- Jobs List -->
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div
          class="w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>
    {:else if jobs.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-lg mb-4">No jobs posted yet</div>
        <p class="text-gray-500 mb-6">
          Create your first job posting to start finding candidates
        </p>
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
          Post Your First Job
        </a>
      </div>
    {:else}
      <div class="grid gap-6">
        {#each jobs as job}
          <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-xl font-semibold text-white">{job.title}</h3>
                  <span
                    class="px-2 py-1 text-xs font-medium text-white rounded-full {getStatusColor(
                      job.status || 'active'
                    )}"
                  >
                    {job.status || "Active"}
                  </span>
                </div>
                <p class="text-gray-400 text-sm mb-2">
                  {job.region || "Remote"}
                </p>
                <p class="text-gray-300 leading-relaxed mb-4">
                  {job.description.substring(0, 200)}...
                </p>

                <!-- Skills -->
                {#if job.skills && job.skills.length > 0}
                  <div class="flex flex-wrap gap-2 mb-4">
                    {#each job.skills.slice(0, 5) as skill}
                      <span
                        class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    {/each}
                    {#if job.skills.length > 5}
                      <span
                        class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                      >
                        +{job.skills.length - 5} more
                      </span>
                    {/if}
                  </div>
                {/if}

                <!-- Stats -->
                <div class="flex gap-6 text-sm text-gray-400">
                  <div class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
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
                  <div class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {job.applications_count || 0} applications
                  </div>
                  <div class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    {job.views_count || 0} views
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col gap-2 ml-6">
                <a
                  href="/jobs/{job.id}"
                  class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors text-center"
                >
                  View Details
                </a>
                <button
                  on:click={() => viewApplications(job)}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Applications ({job.applications_count || 0})
                </button>
                <button
                  on:click={() => viewMatches(job)}
                  class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  AI Matches
                </button>
                <a
                  href="/jobs/{job.id}/edit"
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
                >
                  Edit
                </a>
                <button
                  on:click={() => deleteJob(job.id)}
                  disabled={deletingId === job.id}
                  class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {deletingId === job.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Summary Stats -->
    {#if jobs.length > 0}
      <div class="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-gray-800 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-white">{jobs.length}</div>
          <div class="text-gray-400 text-sm">Total Jobs</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-green-400">
            {jobs.filter((j) => j.status === "active" || !j.status).length}
          </div>
          <div class="text-gray-400 text-sm">Active Jobs</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-blue-400">
            {jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0)}
          </div>
          <div class="text-gray-400 text-sm">Total Applications</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-400">
            {jobs.reduce((sum, job) => sum + (job.views_count || 0), 0)}
          </div>
          <div class="text-gray-400 text-sm">Total Views</div>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Applications Modal -->
{#if showApplicationsModal && selectedJob}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
  >
    <div
      class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900">
            Applications for "{selectedJob.title}"
          </h2>
          <button
            on:click={closeModals}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6">
        {#if loadingApplications}
          <div class="flex justify-center py-8">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
            ></div>
          </div>
        {:else if applications.length === 0}
          <div class="text-center py-8 text-gray-500">
            No applications received yet for this job.
          </div>
        {:else}
          <div class="space-y-4">
            {#each applications as application}
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">
                      {application.candidates.name}
                    </h3>
                    <p class="text-gray-600">{application.candidates.email}</p>
                    {#if application.candidates.phone}
                      <p class="text-gray-600">
                        {application.candidates.phone}
                      </p>
                    {/if}
                    <p class="text-sm text-gray-500 mt-2">
                      Applied {formatDate(application.applied_at)}
                    </p>
                    {#if application.notes}
                      <p
                        class="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded"
                      >
                        {application.notes}
                      </p>
                    {/if}
                  </div>
                  <div class="ml-4 flex flex-col gap-2">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      {application.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : application.status === 'reviewed'
                          ? 'bg-blue-100 text-blue-800'
                          : application.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'}"
                    >
                      {application.status}
                    </span>

                    {#if application.status === "pending"}
                      <div class="flex gap-1">
                        <button
                          on:click={() =>
                            updateApplicationStatus(application.id, "reviewed")}
                          class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Review
                        </button>
                        <button
                          on:click={() =>
                            updateApplicationStatus(application.id, "accepted")}
                          class="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          on:click={() =>
                            updateApplicationStatus(application.id, "rejected")}
                          class="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    {:else if application.status === "reviewed"}
                      <div class="flex gap-1">
                        <button
                          on:click={() =>
                            updateApplicationStatus(application.id, "accepted")}
                          class="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          on:click={() =>
                            updateApplicationStatus(application.id, "rejected")}
                          class="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Matches Modal -->
{#if showMatchesModal && selectedJob}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
  >
    <div
      class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900">
            AI-Powered Matches for "{selectedJob.title}"
          </h2>
          <button
            on:click={closeModals}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6">
        {#if loadingMatches}
          <div class="flex justify-center py-8">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
            ></div>
          </div>
        {:else if matches.length === 0}
          <div class="text-center py-8 text-gray-500">
            No matching candidates found. Candidates need to complete their
            profiles and upload CVs to appear in matches.
          </div>
        {:else}
          <div class="space-y-4">
            {#each matches as match}
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{match.name}</h3>
                    <div class="flex items-center gap-2 mt-1">
                      <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          class="bg-blue-600 h-2 rounded-full"
                          style="width: {(match.similarity * 100).toFixed(1)}%"
                        ></div>
                      </div>
                      <span class="text-sm font-medium text-gray-600">
                        {(match.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <button
                      class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      on:click={() => {
                        // You could add functionality to invite this candidate
                        alert(
                          "Contact candidate functionality can be added here"
                        );
                      }}
                    >
                      Contact Candidate
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
