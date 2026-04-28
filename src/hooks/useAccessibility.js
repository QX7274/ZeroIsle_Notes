/**
 * Accessibility (a11y) Hook
 *
 * Provides accessibility features for React Native components
 * Supports screen readers, reduced motion, and high contrast
 */

import { useState, useEffect, useCallback } from 'react';
import { AccessibilityInfo, Platform, Appearance } from 'react-native';

/**
 * useAccessibility Hook
 *
 * Provides accessibility state and helpers
 */
const useAccessibility = () => {
    const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
    const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
    const [isBoldTextEnabled, setIsBoldTextEnabled] = useState(false);
    const [isGrayscaleEnabled, setIsGrayscaleEnabled] = useState(false);
    const [isInvertColorsEnabled, setIsInvertColorsEnabled] = useState(false);
    const [isReduceTransparencyEnabled, setIsReduceTransparencyEnabled] = useState(false);

    // Initialize and listen for changes
    useEffect(() => {
        // Check initial states
        const initializeA11y = async () => {
            try {
                const screenReader = await AccessibilityInfo.isScreenReaderEnabled();
                setIsScreenReaderEnabled(screenReader);

                const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
                setIsReduceMotionEnabled(reduceMotion);

                if (Platform.OS === 'ios') {
                    const boldText = await AccessibilityInfo.isBoldTextEnabled();
                    setIsBoldTextEnabled(boldText);

                    const grayscale = await AccessibilityInfo.isGrayscaleEnabled();
                    setIsGrayscaleEnabled(grayscale);

                    const invertColors = await AccessibilityInfo.isInvertColorsEnabled();
                    setIsInvertColorsEnabled(invertColors);

                    const reduceTransparency = await AccessibilityInfo.isReduceTransparencyEnabled();
                    setIsReduceTransparencyEnabled(reduceTransparency);
                }
            } catch (error) {
                console.error('Failed to initialize accessibility:', error);
            }
        };

        initializeA11y();

        // Subscribe to changes
        const screenReaderSubscription = AccessibilityInfo.addEventListener(
            'screenReaderChanged',
            setIsScreenReaderEnabled
        );

        const reduceMotionSubscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setIsReduceMotionEnabled
        );

        return () => {
            screenReaderSubscription?.remove();
            reduceMotionSubscription?.remove();
        };
    }, []);

    /**
     * Announce for accessibility (screen reader)
     */
    const announce = useCallback((message) => {
        if (isScreenReaderEnabled) {
            AccessibilityInfo.announceForAccessibility(message);
        }
    }, [isScreenReaderEnabled]);

    /**
     * Set accessibility focus
     */
    const setFocus = useCallback((reactTag) => {
        if (reactTag) {
            AccessibilityInfo.setAccessibilityFocus(reactTag);
        }
    }, []);

    /**
     * Get animation duration based on reduce motion preference
     */
    const getAnimationDuration = useCallback((normalDuration) => {
        return isReduceMotionEnabled ? 0 : normalDuration;
    }, [isReduceMotionEnabled]);

    /**
     * Check if animations should be used
     */
    const shouldAnimate = !isReduceMotionEnabled;

    /**
     * Get accessible color contrast
     */
    const getContrastColor = useCallback((backgroundColor) => {
        // Simple contrast calculation
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }, []);

    return {
        // States
        isScreenReaderEnabled,
        isReduceMotionEnabled,
        isBoldTextEnabled,
        isGrayscaleEnabled,
        isInvertColorsEnabled,
        isReduceTransparencyEnabled,
        shouldAnimate,

        // Methods
        announce,
        setFocus,
        getAnimationDuration,
        getContrastColor,
    };
};

/**
 * Accessibility props generator
 *
 * Generates proper accessibility props for components
 */
export const generateA11yProps = (options) => {
    const {
        label,
        hint,
        role,
        value,
        state,
        actions,
        liveRegion,
        disabled,
    } = options;

    const props = {};

    // Label for screen readers
    if (label) {
        props.accessible = true;
        props.accessibilityLabel = label;
    }

    // Hint for additional context
    if (hint) {
        props.accessibilityHint = hint;
    }

    // Role (button, link, image, etc.)
    if (role) {
        props.accessibilityRole = role;
    }

    // Current value
    if (value !== undefined) {
        props.accessibilityValue = value;
    }

    // State (selected, checked, expanded, etc.)
    if (state) {
        props.accessibilityState = {
            disabled: disabled || state.disabled,
            selected: state.selected,
            checked: state.checked,
            expanded: state.expanded,
            busy: state.busy,
        };
    } else if (disabled) {
        props.accessibilityState = { disabled: true };
    }

    // Actions
    if (actions) {
        props.accessibilityActions = actions;
    }

    // Live region for dynamic content
    if (liveRegion) {
        props.accessibilityLiveRegion = liveRegion;
    }

    return props;
};

/**
 * Common accessibility roles
 */
export const A11yRole = {
    BUTTON: 'button',
    LINK: 'link',
    IMAGE: 'image',
    TEXT: 'text',
    HEADER: 'header',
    SEARCH: 'search',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    SWITCH: 'switch',
    SLIDER: 'adjustable',
    TAB: 'tab',
    TAB_LIST: 'tablist',
    MENU: 'menu',
    MENU_ITEM: 'menuitem',
    PROGRESS_BAR: 'progressbar',
    ALERT: 'alert',
    DIALOG: 'dialog',
    LIST: 'list',
    LIST_ITEM: 'listitem',
    NONE: 'none',
};

/**
 * Generate semantic heading
 */
export const SemanticHeading = ({ level = 1, children, style, ...props }) => {
    const a11yProps = generateA11yProps({
        role: A11yRole.HEADER,
        label: typeof children === 'string' ? children : undefined,
    });

    return (
        <Text
            {...a11yProps}
            style={[
                { fontWeight: 'bold' },
                level === 1 && { fontSize: 24 },
                level === 2 && { fontSize: 20 },
                level === 3 && { fontSize: 18 },
                level === 4 && { fontSize: 16 },
                style,
            ]}
            {...props}
        >
            {children}
        </Text>
    );
};

/**
 * Accessible touch targets
 * Ensures minimum touch target size (44x44 for iOS, 48x48 for Android)
 */
export const getMinTouchTarget = () => {
    return Platform.OS === 'ios' ? 44 : 48;
};

/**
 * Check if touch target is accessible
 */
export const isTouchTargetAccessible = (width, height) => {
    const minSize = getMinTouchTarget();
    return width >= minSize && height >= minSize;
};

export default useAccessibility;
