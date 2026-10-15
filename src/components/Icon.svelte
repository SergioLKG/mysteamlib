<script lang="ts">
  import {
    FILLED_ICON_VIEWBOX,
    ICONS,
    ICON_DEFAULT_SIZE,
    ICON_STROKE_WIDTH,
    type IconName,
  } from '../lib/ui/icons';

  interface Props {
    name: IconName;
    /** Rendered width and height in px. */
    size?: number;
    /** Accessible name. Without it the icon is decorative (aria-hidden). */
    label?: string;
  }

  let { name, size = ICON_DEFAULT_SIZE, label }: Props = $props();
  const filledViewBox = $derived(FILLED_ICON_VIEWBOX[name]);
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox={filledViewBox ?? '0 0 24 24'}
  fill={filledViewBox ? 'currentColor' : 'none'}
  stroke={filledViewBox ? 'none' : 'currentColor'}
  stroke-width={ICON_STROKE_WIDTH}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <!-- Static constants from the icons map, never user input -->
  {@html ICONS[name]}
</svg>

<style>
  .icon {
    flex: none;
  }
</style>
