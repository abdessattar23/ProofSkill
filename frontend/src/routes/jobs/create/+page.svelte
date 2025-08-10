<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { goto } from "$app/navigation";

  let formData = {
    title: "",
    description: "",
    region: "",
    salary_range: "",
    experience_level: "mid",
    job_type: "full-time",
    skills: [] as string[],
  };

  let skillInput = "";
  let loading = false;
  let availableSkills = [
    "JavaScript",
    "Python",
    "React",
    "Node.js",
    "TypeScript",
    "SQL",
    "AWS",
    "Docker",
    "Kubernetes",
    "Go",
    "Java",
    "C++",
  ];

  onMount(() => {
    if (!$auth.user || $auth.user.role !== "business") {
      goto("/dashboard");
      return;
    }
  });

  function addSkill(skill: string) {
    if (skill && !formData.skills.includes(skill)) {
      formData.skills = [...formData.skills, skill];
      skillInput = "";
    }
  }

  function removeSkill(skill: string) {
    formData.skills = formData.skills.filter((s) => s !== skill);
  }

  function addSkillFromInput() {
    if (skillInput.trim()) {
      addSkill(skillInput.trim());
    }
  }

  async function createJob() {
    if (!formData.title.trim() || !formData.description.trim()) {
      toastStore.push("Please fill in title and description", {
        type: "error",
      });
      return;
    }

    loading = true;

    try {
      const response = await fetch("/v1/api/jobs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${$auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          region: formData.region || "Remote",
          salary_range: formData.salary_range,
          experience_level: formData.experience_level,
          job_type: formData.job_type,
          skills: formData.skills,
        }),
      });

      if (response.ok) {
        toastStore.push("Job posted successfully!", { type: "success" });
        goto("/jobs/manage");
      } else {
        const error = await response.json();
        toastStore.push(error.message || "Failed to create job", {
          type: "error",
        });
      }
    } catch (error) {
      toastStore.push("Error creating job", { type: "error" });
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Create Job - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 py-8">
  <div class="max-w-4xl mx-auto px-4">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Post New Job</h1>
      <p class="text-gray-400">
        Create a job posting to find qualified candidates
      </p>
    </div>

    <div class="bg-gray-800 rounded-lg p-8">
      <form on:submit|preventDefault={createJob} class="space-y-6">
        <!-- Job Title -->
        <div>
          <label
            for="title"
            class="block text-sm font-medium text-gray-300 mb-2"
            >Job Title *</label
          >
          <input
            id="title"
            type="text"
            bind:value={formData.title}
            required
            placeholder="e.g. Senior Frontend Developer"
            class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Job Description -->
        <div>
          <label
            for="description"
            class="block text-sm font-medium text-gray-300 mb-2"
            >Job Description *</label
          >
          <textarea
            id="description"
            bind:value={formData.description}
            required
            rows="6"
            placeholder="Describe the role, responsibilities, and requirements..."
            class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          ></textarea>
        </div>

        <!-- Location and Salary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              for="region"
              class="block text-sm font-medium text-gray-300 mb-2"
              >Location</label
            >
            <input
              id="region"
              type="text"
              bind:value={formData.region}
              placeholder="e.g. San Francisco, CA or Remote"
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="salary"
              class="block text-sm font-medium text-gray-300 mb-2"
              >Salary Range</label
            >
            <input
              id="salary"
              type="text"
              bind:value={formData.salary_range}
              placeholder="e.g. $80,000 - $120,000"
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Experience Level and Job Type -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              for="experience"
              class="block text-sm font-medium text-gray-300 mb-2"
              >Experience Level</label
            >
            <select
              id="experience"
              bind:value={formData.experience_level}
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior Level</option>
              <option value="lead">Lead/Principal</option>
            </select>
          </div>

          <div>
            <label
              for="jobtype"
              class="block text-sm font-medium text-gray-300 mb-2"
              >Job Type</label
            >
            <select
              id="jobtype"
              bind:value={formData.job_type}
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="full-time">Full Time</option>
              <option value="part-time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
        </div>

        <!-- Required Skills -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2"
            >Required Skills</label
          >

          <!-- Skill Input -->
          <div class="flex gap-2 mb-3">
            <input
              type="text"
              bind:value={skillInput}
              on:keydown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addSkillFromInput())}
              placeholder="Add a skill..."
              class="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              on:click={addSkillFromInput}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          <!-- Popular Skills -->
          <div class="mb-3">
            <p class="text-xs text-gray-400 mb-2">Popular skills:</p>
            <div class="flex flex-wrap gap-2">
              {#each availableSkills as skill}
                <button
                  type="button"
                  on:click={() => addSkill(skill)}
                  disabled={formData.skills.includes(skill)}
                  class="px-3 py-1 text-sm rounded-full border transition-colors {formData.skills.includes(
                    skill
                  )
                    ? 'bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}"
                >
                  {skill}
                </button>
              {/each}
            </div>
          </div>

          <!-- Selected Skills -->
          {#if formData.skills.length > 0}
            <div>
              <p class="text-xs text-gray-400 mb-2">Selected skills:</p>
              <div class="flex flex-wrap gap-2">
                {#each formData.skills as skill}
                  <span
                    class="px-3 py-1 bg-blue-600 text-white text-sm rounded-full flex items-center gap-2"
                  >
                    {skill}
                    <button
                      type="button"
                      on:click={() => removeSkill(skill)}
                      class="hover:text-gray-300"
                    >
                      ×
                    </button>
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Submit Button -->
        <div class="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={loading}
            class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
          >
            {#if loading}
              <div
                class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
              ></div>
            {/if}
            {loading ? "Creating Job..." : "Post Job"}
          </button>

          <a
            href="/jobs"
            class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  </div>
</div>
