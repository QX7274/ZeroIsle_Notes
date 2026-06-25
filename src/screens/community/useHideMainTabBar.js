import React from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

const collectParentNavigations = (navigation) => {
  const parentNavigations = [];
  let currentNavigation = navigation;

  while (currentNavigation?.getParent?.()) {
    currentNavigation = currentNavigation.getParent();
    if (!currentNavigation) {
      break;
    }
    parentNavigations.push(currentNavigation);
  }

  return parentNavigations;
};

const useHideMainTabBar = () => {
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      const parentNavigations = collectParentNavigations(navigation);

      parentNavigations.forEach((parentNavigation) => {
        parentNavigation?.setOptions?.({
          tabBarStyle: {
            display: 'none',
            position: 'absolute',
          },
        });
      });

      return () => {
        parentNavigations.forEach((parentNavigation) => {
          parentNavigation?.setOptions?.({
            tabBarStyle: undefined,
          });
        });
      };
    }, [navigation])
  );
};

export default useHideMainTabBar;
