// navigation/AppNavigator.js
import React, { useEffect, useState } from "react";
import { NavigationContainer, getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";

import NotificationsModal from "../screens/NotificationsModal";
import HomeScreen from "../screens/HomeScreen";
import NewsDetailScreen from "../screens/NewsDetailScreen";
import AllResultsScreen from "../screens/AllResultsScreen";
import AuthProfileScreen from "../screens/AuthProfileScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import ManageSportCompetitionsScreen from "../screens/sport_coordinator/ManageSportCompetitionsScreen";
import ManageSportMatchesScreen from "../screens/sport_coordinator/ManageSportMatchesScreen";
import ManageSportTeamPositionsScreen from "../screens/sport_coordinator/ManageSportTeamPositionsScreen";
import QRCodeScreen from "../screens/student/QRCodeScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ReportProblemScreen from "../screens/ReportProblemScreen";
import CompetitionsScreen from "../screens/CompetitionsScreen";
import SportsScreen from "../screens/SportsScreen";
import MentorManageScreen from "../screens/mentor/MentorManageScreen";
import NewsPublisher from "../screens/organizer/NewsPublisher";
import TeamsHomeScreen from "../screens/team_leader/TeamsHomeScreen";
import TeamFormScreen from "../screens/team_leader/TeamFormScreen";
import TeamMembersScreen from "../screens/team_leader/TeamMembersScreen";

import UserVerificationScreen from "../screens/science-coordinator/UserVerificationScreen";
import ScienceCompetitionsScreen from "../screens/science-coordinator/ScienceCompetitionsScreen";
import StewardManagementScreen from "../screens/science-coordinator/StewardManagementScreen";
import ScienceResultScreen from "../screens/science-coordinator/ScienceResultScreen";
import MyCompetitionsScreen from "../screens/student/MyCompetitionsScreen";
import TeamLeaderVerificationScreen from "../screens/sport_coordinator/TeamLeaderVerificationScreen";
import StudentVerificationScreen from "../screens/steward/StudentVerificationScreen";

import OrganizerStatsScreen from "../screens/organizer/OrganizerStatsScreen";
import ScienceStatsScreen from "../screens/science-coordinator/ScienceStatsScreen";
import SportStatsScreen from "../screens/sport_coordinator/SportStatsScreen";
import MentorStatsScreen from "../screens/mentor/MentorStatsScreen";
import TeamLeaderStatsScreen from "../screens/team_leader/TeamLeaderStatsScreen";

import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";

import RankingsScreen from "../screens/RankingsScreen";
import CompetitionRankingsScreen from "../screens/CompetitionRankingsScreen";
import FacultyRankingsScreen from "../screens/FacultyRankingsScreen";

import ScheduleModal from "../screens/ScheduleModal";

import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Platform, Text, TextInput, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { navigationRef, globalGoBack } from "./navigationRef";

const Tab = createBottomTabNavigator();
const ProfileStack = createStackNavigator();
const RankingsStack = createStackNavigator();
const HomeScreenStack = createStackNavigator();
const CompetitionsStack = createStackNavigator();

const HomeScreenNavigator = () => {
  const isWeb = Platform.OS === "web";

  const screenOptions = {
    headerShown: false, // koristimo globalni Tab header
    headerTitleStyle: { fontWeight: "bold" },
  };

  if (!isWeb) {
    // zadržavamo tvoju logiku radi mobilnog ponašanja
    // @ts-ignore
    screenOptions.detachPreviousScreen = false;
  }

  return (
    <HomeScreenStack.Navigator screenOptions={screenOptions} detachInactiveScreens={isWeb}>
      <HomeScreenStack.Screen name="HomeScreen" component={HomeScreen} />
      <HomeScreenStack.Screen name="NewsDetail" component={NewsDetailScreen} />
    </HomeScreenStack.Navigator>
  );
};

const RankingsNavigator = () => {
  const isWeb = Platform.OS === "web";

  const screenOptions = {
    headerShown: false, // koristimo globalni Tab header
    headerTitleStyle: { fontWeight: "bold" },
  };

  if (!isWeb) {
    // zadržavamo tvoju logiku radi mobilnog ponašanja
    // @ts-ignore
    screenOptions.detachPreviousScreen = false;
  }

  return (
    <RankingsStack.Navigator screenOptions={screenOptions} detachInactiveScreens={isWeb}>
      <RankingsStack.Screen name="RankingsHome" component={RankingsScreen} />
    </RankingsStack.Navigator>
  );
};

const ProfileNavigator = () => {
  const isWeb = Platform.OS === "web";

  const screenOptions = {
    headerShown: false, // koristimo globalni Tab header
    headerTitleStyle: { fontWeight: "bold" },
  };

  if (!isWeb) {
    // @ts-ignore
    screenOptions.detachPreviousScreen = false;
  }

  return (
    <ProfileStack.Navigator screenOptions={screenOptions} detachInactiveScreens={isWeb}>
      <ProfileStack.Screen name="ProfileHome" component={AuthProfileScreen} />
      <ProfileStack.Screen name="MyCompetitions" component={MyCompetitionsScreen} />
      <ProfileStack.Screen name="MyCompetitionsResults" component={AllResultsScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="MentorManage" component={MentorManageScreen} />

      <ProfileStack.Screen name="NewsPublisher" component={NewsPublisher} />
      <ProfileStack.Screen name="TeamsHome" component={TeamsHomeScreen} />
      <ProfileStack.Screen name="TeamForm" component={TeamFormScreen} />
      <ProfileStack.Screen name="TeamMembers" component={TeamMembersScreen} />
      <ProfileStack.Screen name="ManageSportCompetitions" component={ManageSportCompetitionsScreen} />
      <ProfileStack.Screen name="ManageSportMatches" component={ManageSportMatchesScreen} />
      <ProfileStack.Screen name="ManageSportTeamPositions" component={ManageSportTeamPositionsScreen} />
      <ProfileStack.Screen name="TeamLeaderVerification" component={TeamLeaderVerificationScreen} />
      <ProfileStack.Screen name="UserVerification" component={UserVerificationScreen} />
      <ProfileStack.Screen name="ScienceCompetitions" component={ScienceCompetitionsScreen} />
      <ProfileStack.Screen name="StewardManagement" component={StewardManagementScreen} />
      <ProfileStack.Screen name="ScienceResult" component={ScienceResultScreen} />
      <ProfileStack.Screen name="QRCode" component={QRCodeScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ReportProblem" component={ReportProblemScreen} />
      <ProfileStack.Screen name="StudentVerification" component={StudentVerificationScreen} />
      <ProfileStack.Screen name="OrganizerStats" component={OrganizerStatsScreen} />
      <ProfileStack.Screen name="ScienceStats" component={ScienceStatsScreen} />
      <ProfileStack.Screen name="SportStats" component={SportStatsScreen} />
      <ProfileStack.Screen name="MentorStats" component={MentorStatsScreen} />
      <ProfileStack.Screen name="TeamLeaderStats" component={TeamLeaderStatsScreen} />
      <ProfileStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <ProfileStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </ProfileStack.Navigator>
  );
};


const CompetitionsNavigator = () => {
  const isWeb = Platform.OS === "web";

  const screenOptions = {
    headerShown: false,
    headerTitleStyle: { fontWeight: "bold" },
  };

  if (!isWeb) {
    // @ts-ignore
    screenOptions.detachPreviousScreen = false;
  }

  return (
    <CompetitionsStack.Navigator screenOptions={screenOptions} detachInactiveScreens={isWeb}>
      <CompetitionsStack.Screen name="CompetitionsHome" component={CompetitionsScreen} />
      <CompetitionsStack.Screen name="AllResults" component={AllResultsScreen} />
    </CompetitionsStack.Navigator>
  );
};

const WebNavBar = ({ navigation, currentRouteName, showBack, setScheduleVisible }) => {
  const tabs = ["Početna", "Takmičenja", "Sport", "Rang Lista", "Profil"];
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 700;

  return (
    <View style={{ zIndex: 1000, backgroundColor: "#fff" }}>
      <View style={styles.webNavBar}>
        <View style={styles.webNavLeft}>
          {compact && (
            <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)} style={[styles.webIconButton, { marginRight: 10, borderWidth: 0 }]}>
              <Ionicons name={menuOpen ? "close" : "menu"} size={28} color="#000" />
            </TouchableOpacity>
          )}
          {showBack ? (
            <TouchableOpacity onPress={globalGoBack} style={styles.webBackButton}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
          ) : (
            !compact && <View style={{ width: 28, marginLeft: 12 }} />
          )}
          <Text style={[styles.webLogoText, compact && styles.webLogoTextCompact]}>ELEKTRIJADA</Text>
        </View>

        {!compact && (
          <View style={styles.webNavLinks}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.webNavLinksContent}>
              {tabs.map((tabName, index) => {
                const isFocused = currentRouteName === tabName;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => navigation.navigate(tabName)}
                    style={styles.webNavItem}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.webNavText, isFocused && styles.webNavTextActive]}>
                      {tabName.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.webNavRight}>
          <TouchableOpacity onPress={() => setScheduleVisible(true)} style={styles.webIconButton}>
            <Ionicons name="calendar-outline" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {menuOpen && compact && (
        <View style={styles.mobileMenuOverlay}>
          {tabs.map((tabName, index) => {
            const isFocused = currentRouteName === tabName;
            return (
              <TouchableOpacity
                key={index}
                style={styles.mobileMenuItem}
                onPress={() => {
                  navigation.navigate(tabName);
                  setMenuOpen(false);
                }}
              >
                <Text style={[styles.mobileMenuText, isFocused && styles.mobileMenuTextActive]}>
                  {tabName.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const MainTabs = () => {
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e) => {
      const isBackCombo = (e.altKey || e.metaKey) && e.key === "ArrowLeft";
      if (isBackCombo) {
        e.preventDefault();
        globalGoBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => {
          const initialChildByTab = {
            "Početna": "HomeScreen",
            "Rang Lista": "RankingsHome",
            "Takmičenja": "CompetitionsHome",
            Profil: "ProfileHome",
          };
          const focusedChild = getFocusedRouteNameFromRoute(route);
          const isNestedStack = route.name in initialChildByTab;
          const showBack = isNestedStack && focusedChild && focusedChild !== initialChildByTab[route.name];

          return {
            header: isWeb ? () => (
              <WebNavBar
                navigation={navigation}
                currentRouteName={route.name}
                showBack={showBack}
                setScheduleVisible={setScheduleVisible}
              />
            ) : undefined,

            headerShown: true,

            headerStyle: { backgroundColor: "#f5f5f5" },
            headerTitle: "ELEKTRIJADA",
            headerTitleStyle: { fontWeight: "bold" },
            headerTitleAlign: "left",

            headerLeft: () =>
              showBack ? (
                <TouchableOpacity onPress={globalGoBack} style={{ backgroundColor: "#fff", borderRadius: 20, marginLeft: 15, height: 30, width: 30, outlineColor: "#999", outlineStyle: "solid", outlineWidth: 1, justifyContent: "center", alignItems: "center" }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
              ) : null,

            headerRight: () => (
              <View style={{ flexDirection: "row", marginLeft: 15 }}>
                <TouchableOpacity onPress={() => setScheduleVisible(true)} style={{ backgroundColor: "#fff", borderRadius: 20, marginRight: 15, height: 30, width: 30, outlineColor: "#999", outlineStyle: "solid", outlineWidth: 1, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="calendar-outline" size={24} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNotificationsVisible(true)} style={{ backgroundColor: "#fff", borderRadius: 20, marginRight: 15, height: 30, width: 30, outlineColor: "#999", outlineStyle: "solid", outlineWidth: 1, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="notifications-outline" size={24} color="#000" />
                </TouchableOpacity>
              </View>
            ),

            tabBarShowLabel: false,
            tabBarStyle: isWeb
              ? { display: "none" }
              : {
                position: "absolute",
                backgroundColor: "rgba(23, 22, 22, 0.5)",
                borderTopWidth: 0,
                elevation: 0,
                height: 61,
                borderRadius: 25,
                marginHorizontal: 20,
                marginBottom: 20,
                paddingBottom: 10,
                paddingTop: 10,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
              },
            tabBarIcon: ({ focused }) => {
              let iconName;
              if (route.name === "Početna") iconName = focused ? "home" : "home-outline";
              else if (route.name === "Takmičenja") iconName = focused ? "book" : "book-outline";
              else if (route.name === "Sport") iconName = focused ? "football" : "football-outline";
              else if (route.name === "Rang Lista") iconName = focused ? "stats-chart" : "stats-chart-outline";
              else if (route.name === "Profil") iconName = focused ? "person" : "person-outline";

              return (
                <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                  <Ionicons name={iconName} size={24} color={focused ? "#000000ff" : "#d1d0d0ff"} />
                </View>
              );
            },
            tabBarActiveTintColor: "#fa8d10ff",
            tabBarInactiveTintColor: "gray",
          };
        }}
        detachInactiveScreens={false}
      >
        <Tab.Screen name="Početna" component={HomeScreenNavigator} />
        <Tab.Screen name="Takmičenja" component={CompetitionsNavigator} />
        <Tab.Screen name="Sport" component={SportsScreen} />
        <Tab.Screen name="Rang Lista" component={RankingsNavigator} />
        <Tab.Screen name="Profil" component={ProfileNavigator} />
      </Tab.Navigator>

      <ScheduleModal visible={scheduleVisible} onClose={() => setScheduleVisible(false)} />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  iconContainerActive: {
    backgroundColor: "#fa8d10ff",
    shadowColor: "#fa8d10ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  webNavBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  webNavLeft: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 120,
  },
  webLogoText: {
    fontWeight: "bold",
    fontSize: 20,
    letterSpacing: 1,
    color: "#000",
    marginLeft: 15,
  },
  webLogoTextCompact: {
    fontSize: 16,
    marginLeft: 12,
  },
  webBackButton: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginLeft: 15,
    height: 32,
    width: 32,
    borderWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  webNavLinks: {
    flex: 1,
    justifyContent: "center",
  },
  webNavLinksContent: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  webNavItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: 10,
  },
  webNavItemCompact: {
    paddingHorizontal: 8,
    marginHorizontal: 8,
  },
  webNavText: {
    fontWeight: "600",
    color: "gray",
    fontSize: 14,
  },
  webNavTextActive: {
    color: "#fa8d10ff",
  },
  webNavRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  webIconButton: {
    backgroundColor: "#fff",
    borderRadius: 20,
    height: 35,
    width: 35,
    borderWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileMenuOverlay: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    paddingBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 999,
  },
  mobileMenuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  mobileMenuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  mobileMenuTextActive: {
    color: "#fa8d10ff",
  },
});

const AppNavigator = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10345bff" />
      </View>
    );
  }

  const linking = {
    prefixes: [], // Dovoljno da React Navigation aktivira web history API
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <MainTabs />
    </NavigationContainer>
  );
};

export default AppNavigator;
