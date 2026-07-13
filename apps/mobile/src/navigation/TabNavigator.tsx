/**
 * Bottom tab navigator with 5 tabs.
 *
 * TODO: Add proper icons (e.g. @expo/vector-icons or lucide-react-native).
 * TODO: Add badge on Applications tab showing count of active applications.
 * TODO: Add haptic feedback on tab press.
 * TODO: Conditionally hide tabs based on auth state.
 */

import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { theme } from "../theme"

import DashboardScreen from "../screens/DashboardScreen"
import ApplicationsScreen from "../screens/ApplicationsScreen"
import KanbanScreen from "../screens/KanbanScreen"
import ActionsScreen from "../screens/ActionsScreen"
import StatsScreen from "../screens/StatsScreen"

export type RootTabParamList = {
  Dashboard: undefined
  Applications: undefined
  Kanban: undefined
  Actions: undefined
  Stats: undefined
}

const Tab = createBottomTabNavigator<RootTabParamList>()

export function TabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.mantle,
        },
        headerTintColor: theme.colors.textPrimary,
        tabBarStyle: {
          backgroundColor: theme.colors.mantle,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          // TODO: tabBarIcon: ({ color }) => <Icon name="home" color={color} />
        }}
      />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          title: "Applications",
          // TODO: tabBarIcon, tabBarBadge
        }}
      />
      <Tab.Screen
        name="Kanban"
        component={KanbanScreen}
        options={{
          title: "Kanban",
          // TODO: tabBarIcon
        }}
      />
      <Tab.Screen
        name="Actions"
        component={ActionsScreen}
        options={{
          title: "Actions",
          // TODO: tabBarIcon
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: "Stats",
          // TODO: tabBarIcon
        }}
      />
    </Tab.Navigator>
  )
}
