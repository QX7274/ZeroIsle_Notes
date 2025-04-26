/**
 * 用户状态reducer
 */

// 初始状态
const initialState = {
  profile: null,
  preferences: {},
  isAuthenticated: false,
};

// 用户reducer
const userReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        profile: action.payload,
        isAuthenticated: !!action.payload,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.payload,
        },
      };
    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: action.payload,
      };
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };
    case 'LOGOUT':
      return initialState;
    default:
      return state;
  }
};

export default userReducer;
