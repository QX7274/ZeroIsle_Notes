import { useState, useCallback, useMemo } from 'react';

/**
 * Form Validation Rules
 */
const VALIDATION_RULES = {
    required: (value, message = '此字段为必填项') => {
        if (value === null || value === undefined || value === '') {
            return message;
        }
        if (Array.isArray(value) && value.length === 0) {
            return message;
        }
        return null;
    },

    email: (value, message = '请输入有效的邮箱地址') => {
        if (!value) {return null;}
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : message;
    },

    minLength: (min, message) => (value) => {
        if (!value) {return null;}
        const msg = message || `最少需要 ${min} 个字符`;
        return value.length >= min ? null : msg;
    },

    maxLength: (max, message) => (value) => {
        if (!value) {return null;}
        const msg = message || `最多允许 ${max} 个字符`;
        return value.length <= max ? null : msg;
    },

    pattern: (regex, message = '格式不正确') => (value) => {
        if (!value) {return null;}
        return regex.test(value) ? null : message;
    },

    match: (fieldName, message) => (value, formValues) => {
        const msg = message || `与 ${fieldName} 不匹配`;
        return value === formValues[fieldName] ? null : msg;
    },

    phone: (value, message = '请输入有效的手机号码') => {
        if (!value) {return null;}
        const phoneRegex = /^1[3-9]\d{9}$/;
        return phoneRegex.test(value) ? null : message;
    },

    password: (value, message = '密码需包含大小写字母和数字，至少8位') => {
        if (!value) {return null;}
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return passwordRegex.test(value) ? null : message;
    },

    url: (value, message = '请输入有效的网址') => {
        if (!value) {return null;}
        try {
            new URL(value);
            return null;
        } catch {
            return message;
        }
    },

    numeric: (value, message = '请输入数字') => {
        if (!value) {return null;}
        return /^\d+$/.test(value) ? null : message;
    },

    custom: (validateFn) => validateFn,
};

/**
 * useFormValidation Hook
 *
 * Provides form state management with real-time validation
 *
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationSchema - Validation rules for each field
 * @param {Object} options - Additional options
 * @returns {Object} Form state and handlers
 *
 * @example
 * const { values, errors, touched, handleChange, handleBlur, handleSubmit, isValid } = useFormValidation(
 *   { email: '', password: '' },
 *   {
 *     email: [VALIDATION_RULES.required, VALIDATION_RULES.email],
 *     password: [VALIDATION_RULES.required, VALIDATION_RULES.minLength(8)],
 *   }
 * );
 */
const useFormValidation = (initialValues = {}, validationSchema = {}, options = {}) => {
    const {
        validateOnChange = true,
        validateOnBlur = true,
        validateOnSubmit = true,
    } = options;

    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitCount, setSubmitCount] = useState(0);

    // Validate a single field
    const validateField = useCallback((fieldName, value, allValues = values) => {
        const rules = validationSchema[fieldName];
        if (!rules) {return null;}

        const rulesArray = Array.isArray(rules) ? rules : [rules];

        for (const rule of rulesArray) {
            const error = typeof rule === 'function'
                ? rule(value, allValues)
                : null;
            if (error) {return error;}
        }

        return null;
    }, [validationSchema, values]);

    // Validate all fields
    const validateAllFields = useCallback((valuesToValidate = values) => {
        const newErrors = {};
        let hasErrors = false;

        Object.keys(validationSchema).forEach(fieldName => {
            const error = validateField(fieldName, valuesToValidate[fieldName], valuesToValidate);
            if (error) {
                newErrors[fieldName] = error;
                hasErrors = true;
            }
        });

        return { errors: newErrors, hasErrors };
    }, [validationSchema, validateField, values]);

    // Handle field change
    const handleChange = useCallback((fieldName) => (valueOrEvent) => {
        const value = valueOrEvent?.nativeEvent?.text ?? valueOrEvent?.target?.value ?? valueOrEvent;

        setValues(prev => {
            const newValues = { ...prev, [fieldName]: value };

            if (validateOnChange && touched[fieldName]) {
                const error = validateField(fieldName, value, newValues);
                setErrors(prevErrors => ({
                    ...prevErrors,
                    [fieldName]: error,
                }));
            }

            return newValues;
        });
    }, [validateOnChange, touched, validateField]);

    // Handle field blur
    const handleBlur = useCallback((fieldName) => () => {
        setTouched(prev => ({ ...prev, [fieldName]: true }));

        if (validateOnBlur) {
            const error = validateField(fieldName, values[fieldName]);
            setErrors(prev => ({ ...prev, [fieldName]: error }));
        }
    }, [validateOnBlur, validateField, values]);

    // Handle form submit
    const handleSubmit = useCallback((onSubmit) => async () => {
        setSubmitCount(prev => prev + 1);

        // Mark all fields as touched
        const allTouched = {};
        Object.keys(validationSchema).forEach(key => {
            allTouched[key] = true;
        });
        setTouched(allTouched);

        if (validateOnSubmit) {
            const { errors: validationErrors, hasErrors } = validateAllFields();
            setErrors(validationErrors);

            if (hasErrors) {
                return { success: false, errors: validationErrors };
            }
        }

        setIsSubmitting(true);
        try {
            const result = await onSubmit(values);
            return { success: true, result };
        } catch (error) {
            return { success: false, error };
        } finally {
            setIsSubmitting(false);
        }
    }, [validateOnSubmit, validateAllFields, values, validationSchema]);

    // Reset form
    const resetForm = useCallback((newInitialValues = initialValues) => {
        setValues(newInitialValues);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
        setSubmitCount(0);
    }, [initialValues]);

    // Set field value programmatically
    const setFieldValue = useCallback((fieldName, value) => {
        setValues(prev => ({ ...prev, [fieldName]: value }));
    }, []);

    // Set field error programmatically
    const setFieldError = useCallback((fieldName, error) => {
        setErrors(prev => ({ ...prev, [fieldName]: error }));
    }, []);

    // Set field touched programmatically
    const setFieldTouched = useCallback((fieldName, isTouched = true) => {
        setTouched(prev => ({ ...prev, [fieldName]: isTouched }));
    }, []);

    // Check if form is valid
    const isValid = useMemo(() => {
        const { hasErrors } = validateAllFields();
        return !hasErrors;
    }, [validateAllFields]);

    // Check if form is dirty (values changed from initial)
    const isDirty = useMemo(() => {
        return Object.keys(initialValues).some(
            key => values[key] !== initialValues[key]
        );
    }, [initialValues, values]);

    // Get field props helper
    const getFieldProps = useCallback((fieldName) => ({
        value: values[fieldName] || '',
        onChangeText: handleChange(fieldName),
        onBlur: handleBlur(fieldName),
        error: touched[fieldName] ? errors[fieldName] : null,
    }), [values, errors, touched, handleChange, handleBlur]);

    return {
        // State
        values,
        errors,
        touched,
        isSubmitting,
        isValid,
        isDirty,
        submitCount,

        // Handlers
        handleChange,
        handleBlur,
        handleSubmit,
        resetForm,

        // Setters
        setFieldValue,
        setFieldError,
        setFieldTouched,
        setValues,
        setErrors,
        setTouched,

        // Helpers
        getFieldProps,
        validateField,
        validateAllFields,
    };
};

// Export validation rules for external use
export { VALIDATION_RULES };
export default useFormValidation;
