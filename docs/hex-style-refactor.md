# Hex Style Refactor Plan

## Executive Summary

The current hex grid implementation is fighting against react-hexgrid's design patterns, causing fill colors to not render properly. This plan outlines a comprehensive refactor to use react-hexgrid correctly while maintaining beautiful visuals and robust theme support.

## Current Issues Analysis

### 1. **Fill Color Problem**
- React-hexgrid's `<Hexagon>` component creates its own `<polygon>` internally
- Our `fill` prop is being passed to the component but not reaching the actual SVG polygon
- The library's CSS imports are potentially overriding our styles
- We're mixing inline styles, CSS variables, and component props inconsistently

### 2. **Animation Conflicts**
- Framer Motion's `motion.g` wrapper around react-hexgrid components may interfere with the library's internal SVG structure
- React-hexgrid has its own animation patterns that we're not leveraging

### 3. **Styling Architecture Issues**
- Multiple styling approaches (inline styles, CSS classes, CSS variables) create precedence conflicts
- Theme loading happens after component mount, causing initial render with incorrect colors
- CSS variable computation in `useEffect` is reactive but not optimal

## Proposed Solution: Three-Phase Refactor

### Phase 1: Fix Core Styling (Priority: Critical)

#### 1.1 Implement Proper react-hexgrid Styling Pattern
Based on the library's examples, the correct approach is:

```tsx
// CORRECT: Use CSS classes with react-hexgrid
<Hexagon 
  q={hex.q} 
  r={hex.r} 
  s={hex.s}
  className={`hex-${hex.terrain}`}
  data-hover={isHovered}
  data-selected={isSelected}
/>
```

#### 1.2 Replace Inline Styles with CSS Classes
- Create terrain-specific CSS classes that use CSS variables
- Leverage CSS custom properties for dynamic theming
- Use CSS-in-JS pattern shown in react-hexgrid storybook examples

#### 1.3 Fix CSS Variable Integration
- Pre-compute terrain colors during theme loading
- Use CSS custom properties directly in stylesheets
- Eliminate runtime `getComputedStyle` calls

### Phase 2: Optimize Animations (Priority: High)

#### 2.1 Use react-hexgrid's Animation Patterns
- Replace Framer Motion with CSS animations for hex-level effects
- Use react-hexgrid's built-in transition support
- Keep Framer Motion for complex UI animations (overlays, modals, etc.)

#### 2.2 Implement Performance-Optimized Animations
```css
/* CSS-based hex animations */
.hex-terrain1 {
  fill: var(--color-terrain-1);
  transition: all 0.2s ease;
}

.hex-terrain1[data-hover="true"] {
  filter: brightness(1.1) drop-shadow(0 0 8px rgba(255,255,255,0.4));
  transform: scale(1.05);
}

.hex-terrain1[data-producing="true"] {
  animation: hex-pulse 1.5s ease-in-out infinite;
}
```

#### 2.3 Optimize Children Elements
- Move icons, number tokens, and overlays to CSS pseudo-elements where possible
- Use SVG `<use>` elements for repeated graphics
- Implement proper z-indexing with CSS layers

### Phase 3: Enhance Visual System (Priority: Medium)

#### 3.1 Implement Advanced Visual Effects
- Add subtle glass morphism using CSS backdrop-filter
- Implement smooth theme transitions with CSS custom property animations
- Add micro-interactions for better UX

#### 3.2 Responsive Hex Sizing
- Implement viewport-based hex sizing using CSS clamp()
- Ensure proper centering across different screen sizes
- Add zoom controls for accessibility

#### 3.3 Performance Optimizations
- Use CSS `contain` property for rendering isolation
- Implement `will-change` hints for animated elements
- Optimize for 60fps performance on lower-end devices

## Implementation Strategy

### Step 1: CSS Architecture Refactor
1. **Create hex-specific CSS classes in globals.css**
   ```css
   /* Terrain base classes */
   .hex-terrain1 { fill: var(--color-terrain-1); }
   .hex-terrain2 { fill: var(--color-terrain-2); }
   /* ... etc */
   
   /* State modifiers */
   .hex-hover { filter: brightness(1.1); transform: scale(1.05); }
   .hex-selected { stroke: white; stroke-width: 2; stroke-dasharray: 4,2; }
   .hex-producing { animation: hex-pulse 1.5s infinite; }
   ```

2. **Simplify component logic**
   ```tsx
   <Hexagon 
     q={hex.q} r={hex.r} s={hex.s}
     className={cn(
       `hex-${hex.terrain}`,
       isHovered && 'hex-hover',
       isSelected && 'hex-selected',
       isProducing && 'hex-producing'
     )}
   />
   ```

### Step 2: Remove Problematic Patterns
1. **Eliminate runtime style computation**
   - Remove `getComputedStyle` calls in component
   - Pre-compute colors during theme loading
   - Use CSS custom properties directly

2. **Simplify animation approach**
   - Replace Framer Motion with CSS animations for hexes
   - Keep Motion for complex UI components
   - Use CSS transforms for performance

### Step 3: Fix Layout and Centering
1. **Proper viewBox calculation**
   ```tsx
   const viewBox = useMemo(() => {
     const padding = hexSize * 2;
     const width = boardWidth + padding * 2;
     const height = boardHeight + padding * 2;
     return `${-width/2} ${-height/2} ${width} ${height}`;
   }, [boardWidth, boardHeight, hexSize]);
   ```

2. **Responsive container**
   ```css
   .hex-container {
     width: 100vw;
     height: 100vh;
     display: flex;
     align-items: center;
     justify-content: center;
   }
   ```

## Technical Considerations

### CSS Specificity Management
- Use CSS layers to control specificity
- Avoid `!important` declarations
- Follow BEM naming convention for hex classes

### Performance Targets
- 60fps animations on all target devices
- < 100ms theme switching time
- < 50ms hover response time

### Browser Compatibility
- Support CSS custom properties (IE11+)
- Use CSS containment where supported
- Fallback patterns for older browsers

### Theme System Integration
- Maintain current theme loading architecture
- Ensure CSS variables update properly
- Support dynamic theme switching

## Testing Strategy

### Visual Regression Tests
- Screenshot comparison for each terrain type
- Theme switching visual tests
- Animation state tests

### Performance Tests
- Animation frame rate monitoring
- Memory usage during long play sessions
- Theme switching performance benchmarks

### Cross-browser Tests
- Chrome, Firefox, Safari, Edge
- Mobile browsers (iOS Safari, Chrome Mobile)
- Different screen sizes and pixel densities

## Migration Plan

### Day 1: Core Styling Fix
- Implement CSS class-based styling
- Fix fill color rendering
- Basic hover states

### Day 2: Animation Optimization
- Replace Motion with CSS animations
- Optimize performance
- Fix centering issues

### Day 3: Polish and Testing
- Add visual enhancements
- Cross-browser testing
- Performance optimization

## Success Metrics

1. **Visual Quality**: All terrain colors render correctly
2. **Performance**: 60fps animations, < 100ms interactions
3. **Robustness**: Works across all supported browsers and themes
4. **Maintainability**: Clear separation of concerns, easy to extend
5. **User Experience**: Smooth, responsive, beautiful game board

## Risk Mitigation

### Breaking Changes
- Maintain backwards compatibility during transition
- Feature flag new implementation
- Rollback plan if issues arise

### Performance Risks
- Benchmark before and after changes
- Monitor memory usage patterns
- Test on low-end devices

### Visual Consistency
- Maintain exact color specifications
- Preserve existing animation timings
- Keep current interaction patterns

---

This refactor will create a robust, performant, and beautiful hex grid system that properly leverages react-hexgrid while maintaining all current functionality and visual appeal. 