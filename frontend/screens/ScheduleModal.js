// screens/ScheduleModal.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/client";

const { height } = Dimensions.get("window");

const primary = "#10345bff"; // sport
const orange = "#fa8d10ff"; // science competition
const purple = "#7c3aed"; // review appointment ("uvid")

const HOUR_HEIGHT = 80; // Visina jednog sata u pikselima

const toYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const ScheduleModal = ({ visible, onClose }) => {
  const [viewMode, setViewMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [competitions, setCompetitions] = useState([]);
  const [reviews, setReviews] = useState([]); // NEW: review appointments (uvid)
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
      fetchScheduleData();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) {
      fetchScheduleData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, viewMode]);

  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      if (viewMode === "day") {
        const dateStr = toYYYYMMDD(selectedDate);
        const response = await apiClient.get(`/schedule/by-date?date=${dateStr}`);
        setCompetitions(response.data?.competitions || []);
        setMatches(response.data?.matches || []);
        setReviews(response.data?.reviews || []);
      } else {
        const weekDays = getWeekDays();
        const startDate = toYYYYMMDD(weekDays[0]);
        const endDate = toYYYYMMDD(weekDays[6]);

        const response = await apiClient.get(`/schedule/by-range?startDate=${startDate}&endDate=${endDate}`);
        setCompetitions(response.data?.competitions || []);
        setMatches(response.data?.matches || []);
        setReviews(response.data?.reviews || []);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setCompetitions([]);
      setMatches([]);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getHours = () => Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

  const formatTime = (hour, minute = 0) => {
    const h = String(Math.floor(hour)).padStart(2, "0");
    const m = String(minute).padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatTimeFromString = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    return `${parts[0]}:${parts[1]}`;
  };

  const getDayName = (date, short = true) => {
    const daysShort = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"];
    const daysLong = ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"];
    return short ? daysShort[date.getDay()] : daysLong[date.getDay()];
  };

  const getMonthName = (date) => {
    const months = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
    return months[date.getMonth()];
  };

  const isToday = (date) => {
    const today = new Date();
    return toYYYYMMDD(date) === toYYYYMMDD(today);
  };

  // Parsiranje vremena u minute od ponoći
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || "0", 10);
    return hours * 60 + minutes;
  };

  // Dobijanje svih događaja za određeni dan sa pozicijom i visinom
  const getEventsForDate = (date) => {
    const dateStr = toYYYYMMDD(date);
    const events = [];
    const startHour = 8; // Početak rasporeda

    // Naučna takmičenja (termin takmičenja)
    competitions.forEach((comp) => {
      if (comp.datum) {
        const compDateObj = new Date(comp.datum);
        const compDateStr = toYYYYMMDD(compDateObj);

        if (compDateStr === dateStr && comp.vrijeme) {
          const startMinutes = parseTimeToMinutes(comp.vrijeme);
          if (startMinutes === null) return;

          const duration = comp.trajanje || 120;
          const endMinutes = startMinutes + duration;

          const topOffset = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
          const eventHeight = (duration / 60) * HOUR_HEIGHT;

          events.push({
            type: "nauka",
            title: comp.naziv_predmeta,
            subtitle: comp.lokacija,
            startTime: formatTimeFromString(comp.vrijeme),
            endTime: formatTime(Math.floor(endMinutes / 60), endMinutes % 60),
            mentor: comp.mentor,
            id: `science-${comp.id}`,
            topOffset,
            height: Math.max(eventHeight, 40),
            startMinutes,
            duration,
          });
        }
      }
    });

    // Uvid (review appointment)
    reviews.forEach((rev) => {
      if (rev.datum) {
        const revDateObj = new Date(rev.datum);
        const revDateStr = toYYYYMMDD(revDateObj);

        if (revDateStr === dateStr && rev.vrijeme) {
          const startMinutes = parseTimeToMinutes(rev.vrijeme);
          if (startMinutes === null) return;

          const duration = rev.trajanje || 30;
          const endMinutes = startMinutes + duration;

          const topOffset = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
          const eventHeight = (duration / 60) * HOUR_HEIGHT;

          events.push({
            type: "uvid",
            title: `Uvid: ${rev.naziv_predmeta}`,
            subtitle: rev.lokacija,
            startTime: formatTimeFromString(rev.vrijeme),
            endTime: formatTime(Math.floor(endMinutes / 60), endMinutes % 60),
            mentor: rev.mentor,
            id: `review-${rev.id}`,
            topOffset,
            height: Math.max(eventHeight, 40),
            startMinutes,
            duration,
          });
        }
      }
    });

    // Sportski mečevi
    matches.forEach((match) => {
      if (match.datum) {
        const matchDateObj = new Date(match.datum);
        const matchDateStr = toYYYYMMDD(matchDateObj);

        if (matchDateStr === dateStr && match.vrijeme) {
          const startMinutes = parseTimeToMinutes(match.vrijeme);
          if (startMinutes === null) return;

          const duration = match.trajanje || 120;
          const endMinutes = startMinutes + duration;

          const topOffset = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
          const eventHeight = (duration / 60) * HOUR_HEIGHT;

          let title = `${match.tim1} vs ${match.tim2}`;
          let hasResult = false;
          if (match.rezultat_tim1 !== null && match.rezultat_tim2 !== null) {
            title = `${match.tim1} ${match.rezultat_tim1} - ${match.rezultat_tim2} ${match.tim2}`;
            hasResult = true;
          }

          events.push({
            type: "sport",
            title,
            subtitle: `${match.vrsta_sporta} • ${match.lokacija}`,
            startTime: formatTimeFromString(match.vrijeme),
            endTime: formatTime(Math.floor(endMinutes / 60), endMinutes % 60),
            stage: match.stage,
            status: match.status,
            hasResult,
            id: `match-${match.id}`,
            topOffset,
            height: Math.max(eventHeight, 40),
            startMinutes,
            duration,
          });
        }
      }
    });

    // Sortiraj po vremenu početka
    events.sort((a, b) => a.startMinutes - b.startMinutes);

    return events;
  };

  // Navigacija sedmice
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const goToToday = () => setSelectedDate(new Date());

  // Week View
  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hours = getHours();
    const screenWidth = Dimensions.get("window").width;
    const timeColumnWidth = 55;
    const availableWidth = screenWidth - timeColumnWidth - 20;
    const dayWidth = Math.max(85, availableWidth / 7);
    const totalWidth = timeColumnWidth + dayWidth * 7;

    const totalHeight = hours.length * HOUR_HEIGHT;

    return (
      <View style={styles.weekWrapper}>
        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={22} color={primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Danas</Text>
          </TouchableOpacity>

          <Text style={styles.weekRangeText}>
            {weekDays[0].getDate()}. - {weekDays[6].getDate()}. {getMonthName(weekDays[6])}
          </Text>

          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={22} color={primary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"}>
          <View style={{ width: totalWidth }}>
            {/* Header sa danima */}
            <View style={styles.weekHeader}>
              <View style={[styles.timeColumnHeader, { width: timeColumnWidth }]} />
              {weekDays.map((day, index) => {
                const today = isToday(day);
                const hasEvents = getEventsForDate(day).length > 0;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.dayColumnHeader, { width: dayWidth }, today && styles.dayColumnHeaderToday]}
                    onPress={() => {
                      setSelectedDate(day);
                      setViewMode("day");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayName, today && styles.dayNameToday]}>{getDayName(day)}</Text>
                    <View style={[styles.dayDateCircle, today && styles.dayDateCircleToday]}>
                      <Text style={[styles.dayDate, today && styles.dayDateToday]}>{day.getDate()}</Text>
                    </View>
                    {hasEvents && <View style={styles.eventIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Scrollable content */}
            <ScrollView style={styles.weekContent} showsVerticalScrollIndicator={Platform.OS === "web"}>
              <View style={{ height: totalHeight, flexDirection: "row" }}>
                {/* Time column */}
                <View style={[styles.timeColumn, { width: timeColumnWidth }]}>
                  {hours.map((hour) => (
                    <View key={hour} style={[styles.hourCell, { height: HOUR_HEIGHT }]}>
                      <Text style={styles.hourText}>{formatTime(hour)}</Text>
                    </View>
                  ))}
                </View>

                {/* Days columns with events */}
                {weekDays.map((day, dayIndex) => {
                  const events = getEventsForDate(day);
                  const today = isToday(day);

                  return (
                    <View
                      key={dayIndex}
                      style={[styles.dayColumnContent, { width: dayWidth }, today && styles.dayColumnContentToday]}
                    >
                      {/* Grid lines */}
                      {hours.map((hour) => (
                        <View key={hour} style={[styles.hourGridLine, { height: HOUR_HEIGHT }]} />
                      ))}

                      {/* Events */}
                      {events.map((event, eventIndex) => (
                        <TouchableOpacity
                          key={event.id || eventIndex}
                          style={[
                            styles.weekEventBlock,
                            event.type === "nauka"
                              ? styles.eventNauka
                              : event.type === "uvid"
                                ? styles.eventUvid
                                : styles.eventSport,
                            {
                              top: event.topOffset,
                              height: event.height - 4,
                              left: 2,
                              right: 2,
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedDate(day);
                            setViewMode("day");
                          }}
                        >
                          <Text style={styles.weekEventTime}>{event.startTime}</Text>
                          <Text style={styles.weekEventTitle} numberOfLines={2}>
                            {event.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Day View
  const renderDayView = () => {
    const hours = getHours();
    const events = getEventsForDate(selectedDate);
    const today = isToday(selectedDate);
    const totalHeight = hours.length * HOUR_HEIGHT;

    return (
      <View style={styles.dayWrapper}>
        {/* Day Navigation */}
        <View style={styles.dayNavigation}>
          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={24} color={primary} />
          </TouchableOpacity>

          <View style={styles.dayTitleContainer}>
            <Text style={styles.dayTitleMain}>{getDayName(selectedDate, false)}</Text>
            <Text style={styles.dayTitleSub}>
              {selectedDate.getDate()}. {getMonthName(selectedDate)} {selectedDate.getFullYear()}.
            </Text>
            {today && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>DANAS</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            style={styles.navButton}
          >
            <Ionicons name="chevron-forward" size={24} color={primary} />
          </TouchableOpacity>
        </View>

        {/* Back to week */}
        <TouchableOpacity style={styles.backToWeekButton} onPress={() => setViewMode("week")}>
          <Ionicons name="calendar-outline" size={18} color={primary} />
          <Text style={styles.backToWeekText}>Nazad na sedmicu</Text>
        </TouchableOpacity>

        {events.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <Ionicons name="calendar-clear-outline" size={64} color="#ccc" />
            <Text style={styles.noEventsText}>Nema zakazanih događaja</Text>
            <Text style={styles.noEventsSubtext}>za ovaj dan</Text>
          </View>
        ) : (
          <ScrollView style={styles.dayContent} showsVerticalScrollIndicator={Platform.OS === "web"}>
            <View style={{ height: totalHeight, position: "relative" }}>
              {/* Time grid */}
              <View style={styles.dayTimeGrid}>
                {hours.map((hour) => (
                  <View key={hour} style={[styles.dayHourRow, { height: HOUR_HEIGHT }]}>
                    <View style={styles.dayTimeLabel}>
                      <Text style={styles.dayHourText}>{formatTime(hour)}</Text>
                    </View>
                    <View style={styles.dayHourLine} />
                  </View>
                ))}
              </View>

              {/* Events */}
              <View style={styles.dayEventsLayer}>
                {events.map((event, index) => (
                  <View
                    key={event.id || index}
                    style={[
                      styles.dayEventBlock,
                      event.type === "nauka"
                        ? styles.eventNauka
                        : event.type === "uvid"
                          ? styles.eventUvid
                          : styles.eventSport,
                      {
                        top: event.topOffset,
                        height: event.height - 6,
                      },
                    ]}
                  >
                    <View style={styles.dayEventHeader}>
                      <View style={styles.dayEventTimeContainer}>
                        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.dayEventTimeText}>
                          {event.startTime} - {event.endTime}
                        </Text>
                      </View>

                      {event.type === "sport" && event.status && (
                        <View
                          style={[
                            styles.statusBadge,
                            event.status === "Završeno" && styles.statusFinished,
                            event.status === "U toku" && styles.statusLive,
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>{event.status}</Text>
                        </View>
                      )}

                      {event.type === "uvid" && (
                        <View style={[styles.statusBadge, styles.statusUvid]}>
                          <Text style={styles.statusBadgeText}>UVID</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.dayEventTitle}>{event.title}</Text>

                    {event.subtitle && (
                      <View style={styles.dayEventSubtitleRow}>
                        <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.dayEventSubtitle}>{event.subtitle}</Text>
                      </View>
                    )}

                    {event.type === "nauka" && event.mentor && (
                      <View style={styles.dayEventInfoRow}>
                        <Ionicons name="person-outline" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.dayEventInfo}>Mentor: {event.mentor}</Text>
                      </View>
                    )}

                    {event.type === "uvid" && event.mentor && (
                      <View style={styles.dayEventInfoRow}>
                        <Ionicons name="person-outline" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.dayEventInfo}>Mentor: {event.mentor}</Text>
                      </View>
                    )}

                    {event.type === "sport" && event.stage && (
                      <View style={styles.dayEventInfoRow}>
                        <Ionicons name="trophy-outline" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.dayEventInfo}>{event.stage}</Text>
                      </View>
                    )}

                    <View style={styles.dayEventDuration}>
                      <Ionicons name="hourglass-outline" size={11} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.dayEventDurationText}>{event.duration} min</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Raspored</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* View Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "week" && styles.toggleButtonActive]}
              onPress={() => setViewMode("week")}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={viewMode === "week" ? primary : "#666"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.toggleText, viewMode === "week" && styles.toggleTextActive]}>Sedmica</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "day" && styles.toggleButtonActive]}
              onPress={() => setViewMode("day")}
            >
              <Ionicons
                name="today-outline"
                size={18}
                color={viewMode === "day" ? primary : "#666"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.toggleText, viewMode === "day" && styles.toggleTextActive]}>Dan</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: orange }]} />
              <Text style={styles.legendText}>Naučna takmičenja</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: purple }]} />
              <Text style={styles.legendText}>Uvid</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: primary }]} />
              <Text style={styles.legendText}>Sportski mečevi</Text>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={orange} />
              <Text style={styles.loadingText}>Učitavanje rasporeda...</Text>
            </View>
          ) : viewMode === "week" ? (
            renderWeekView()
          ) : (
            renderDayView()
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    height: height * 0.92,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  closeButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  headerSpacer: { width: 36 },

  toggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: { fontSize: 14, color: "#666", fontWeight: "500" },
  toggleTextActive: { color: primary, fontWeight: "600" },

  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#666" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#666" },

  weekWrapper: { flex: 1 },
  weekNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: orange,
  },
  todayButtonText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  weekRangeText: { fontSize: 14, fontWeight: "600", color: "#333" },

  weekHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#e8e8e8",
    backgroundColor: "#fff",
  },
  timeColumnHeader: { borderRightWidth: 1, borderRightColor: "#e8e8e8" },
  dayColumnHeader: {
    paddingVertical: 10,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#f0f0f0",
  },
  dayColumnHeaderToday: { backgroundColor: "rgba(250, 141, 16, 0.08)" },
  dayName: { fontSize: 12, fontWeight: "500", color: "#888", marginBottom: 4 },
  dayNameToday: { color: orange },
  dayDateCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  dayDateCircleToday: { backgroundColor: orange },
  dayDate: { fontSize: 16, fontWeight: "bold", color: "#333" },
  dayDateToday: { color: "#fff" },
  eventIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: primary, marginTop: 4 },

  weekContent: { flex: 1 },
  timeColumn: { borderRightWidth: 1, borderRightColor: "#e8e8e8", backgroundColor: "#fafafa" },
  hourCell: { justifyContent: "flex-start", paddingTop: 4, paddingRight: 8, alignItems: "flex-end" },
  hourText: { fontSize: 11, color: "#999", fontWeight: "500" },
  dayColumnContent: { position: "relative", borderRightWidth: 1, borderRightColor: "#f0f0f0" },
  dayColumnContentToday: { backgroundColor: "rgba(250, 141, 16, 0.03)" },
  hourGridLine: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },

  weekEventBlock: { position: "absolute", borderRadius: 6, padding: 4, overflow: "hidden" },
  weekEventTime: { fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginBottom: 2 },
  weekEventTitle: { fontSize: 10, fontWeight: "600", color: "#fff", lineHeight: 12 },

  eventNauka: { backgroundColor: orange },
  eventSport: { backgroundColor: primary },
  eventUvid: { backgroundColor: purple },

  dayWrapper: { flex: 1 },
  dayNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dayTitleContainer: { alignItems: "center" },
  dayTitleMain: { fontSize: 18, fontWeight: "bold", color: "#333" },
  dayTitleSub: { fontSize: 13, color: "#666", marginTop: 2 },
  todayBadge: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: orange, borderRadius: 10 },
  todayBadgeText: { fontSize: 10, fontWeight: "bold", color: "#fff" },

  backToWeekButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backToWeekText: { fontSize: 13, color: primary, fontWeight: "500" },

  noEventsContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 80 },
  noEventsText: { fontSize: 18, fontWeight: "600", color: "#999", marginTop: 16 },
  noEventsSubtext: { fontSize: 14, color: "#bbb", marginTop: 4 },

  dayContent: { flex: 1, paddingHorizontal: 12 },
  dayTimeGrid: { position: "absolute", top: 0, left: 0, right: 0 },
  dayHourRow: { flexDirection: "row", alignItems: "flex-start" },
  dayTimeLabel: { width: 50, paddingRight: 10, alignItems: "flex-end" },
  dayHourText: { fontSize: 12, color: "#999", fontWeight: "500" },
  dayHourLine: { flex: 1, height: 1, backgroundColor: "#f0f0f0", marginTop: 8 },

  dayEventsLayer: { position: "absolute", top: 0, left: 60, right: 8 },
  dayEventBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 10,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dayEventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dayEventTimeContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  dayEventTimeText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "600" },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statusFinished: { backgroundColor: "rgba(52, 199, 89, 0.9)" },
  statusLive: { backgroundColor: "rgba(255, 59, 48, 0.9)" },
  statusUvid: { backgroundColor: "rgba(255,255,255,0.22)" },
  statusBadgeText: { fontSize: 10, fontWeight: "600", color: "#fff" },

  dayEventTitle: { fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 6 },
  dayEventSubtitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  dayEventSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  dayEventInfoRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  dayEventInfo: { fontSize: 11, color: "rgba(255,255,255,0.8)" },

  dayEventDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  dayEventDurationText: { fontSize: 10, color: "rgba(255,255,255,0.7)" },
});

export default ScheduleModal;