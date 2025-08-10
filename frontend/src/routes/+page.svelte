<script>
  import { onMount } from "svelte";

  let mounted = false;

  onMount(() => {
    mounted = true;
  });
</script>

<svelte:head>
  <title>ProofSkill AI - Advanced Skill Assessment Platform</title>
</svelte:head>

<!-- Hero Section -->
<section class="relative py-20 lg:py-32">
  <div class="container mx-auto px-4">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl lg:text-6xl font-bold tracking-tight mb-6">
        AI-Powered
        <span class="text-brand">Skill Assessment</span>
        Platform
      </h1>
      <p class="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
        Revolutionary talent verification through advanced AI analysis. Assess
        technical skills, communication abilities, and professional competencies
        with unprecedented accuracy.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/auth/register" class="btn btn-primary btn-lg">
          Start Free Assessment
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
        <a href="/demo" class="btn btn-outline btn-lg">
          Watch Demo
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section class="py-20 bg-surface">
  <div class="container mx-auto px-4">
    <div class="text-center mb-16">
      <h2 class="text-3xl lg:text-4xl font-bold mb-4">
        Advanced Assessment Capabilities
      </h2>
      <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
        Leverage cutting-edge AI to evaluate candidates across multiple
        dimensions
      </p>
    </div>

    <div class="grid md:grid-cols-3 gap-8">
      <!-- Technical Skills -->
      <div class="card p-8 text-center">
        <div
          class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-brand"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="16,18 22,12 16,6" />
            <polyline points="8,6 2,12 8,18" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">Technical Excellence</h3>
        <p class="text-muted-foreground">
          Comprehensive coding assessments, system design evaluation, and
          technical problem-solving analysis
        </p>
      </div>

      <!-- Communication -->
      <div class="card p-8 text-center">
        <div
          class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-brand"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">Communication Skills</h3>
        <p class="text-muted-foreground">
          AI-powered speech analysis, presentation skills, and professional
          communication assessment
        </p>
      </div>

      <!-- Analytics -->
      <div class="card p-8 text-center">
        <div
          class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-6 h-6 text-brand"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-3">Advanced Analytics</h3>
        <p class="text-muted-foreground">
          Real-time performance metrics, predictive hiring insights, and
          comprehensive reporting
        </p>
      </div>
    </div>
  </div>
</section>

<!-- CTA Section -->
<section class="py-20">
  <div class="container mx-auto px-4">
    <div class="card p-12 text-center max-w-4xl mx-auto">
      <h2 class="text-3xl lg:text-4xl font-bold mb-4">
        Ready to Transform Your Hiring?
      </h2>
      <p class="text-lg text-muted-foreground mb-8">
        Join leading companies using ProofSkill AI to identify top talent faster
        and more accurately than ever before.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/auth/register" class="btn btn-primary btn-lg"
          >Start Free Trial</a
        >
        <a href="/contact" class="btn btn-outline btn-lg">Contact Sales</a>
      </div>
    </div>
  </div>
</section>
