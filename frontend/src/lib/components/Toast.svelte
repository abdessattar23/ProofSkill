<script lang="ts">
  import { onMount } from "svelte";
  import { toastStore } from "$lib/stores/toast";

  let toasts: any[] = [];

  toastStore.subscribe((value) => {
    toasts = value;
  });

  function getToastStyles(type: string) {
    switch (type) {
      case "success":
        return "bg-success/10 border-success/20 text-success";
      case "error":
        return "bg-destructive/10 border-destructive/20 text-destructive";
      case "warning":
        return "bg-warning/10 border-warning/20 text-warning";
      default:
        return "bg-primary/10 border-primary/20 text-primary";
    }
  }

  function getToastIcon(type: string) {
    switch (type) {
      case "success":
        return "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
      case "error":
        return "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z";
      case "warning":
        return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z";
      default:
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
    }
  }
</script>

{#if toasts.length > 0}
  <div class="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
    {#each toasts as toast (toast.id)}
      <div
        class="pointer-events-auto flex items-center gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300 {getToastStyles(
          toast.type
        )}"
      >
        <svg
          class="h-5 w-5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d={getToastIcon(toast.type)} />
        </svg>
        <div class="flex-1 text-sm font-medium">
          {toast.message}
        </div>
        <button
          on:click={() => toastStore.dismiss(toast.id)}
          class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}
