import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { ExperienceData } from "./data/ExperienceData";
import type { FC } from "react";

interface I_PdfProps {
  summaryData: string;
  mainExperienceData: string[];
  skillsData: string[];
}

const NORMAL_FONT_SIZE = "0.55rem";
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#E4E4E4",
    paddingVertical: "50px",
    paddingHorizontal: "30px",
  },
  header: {
    fontSize: "1.5rem",
    fontWeight: 800,
  },
  references: {
    fontSize: "0.48rem",
    borderBottom: "1px solid black",
    textAlign: "center",
    display: "flex",
    flexDirection: "row",
    fontWeight: "normal",
    justifyContent: "space-between",
    paddingBottom: "1px",
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heading: {
    fontWeight: "800",
    textAlign: "left",
    paddingBottom: "1px",
    marginBottom: "2px",
    width: "100%",
    borderBottom: "2px solid gray",
    fontSize: "0.8rem",
    fontStyle: "normal",
  },
  summary: {
    fontSize: NORMAL_FONT_SIZE,
  },
  experience: {
    fontSize: NORMAL_FONT_SIZE,
  },
  companyDetails: {
    fontStyle: "italic",
    fontWeight: 800,
    fontSize: "0.75rem",
  },
  positionDetails: {
    fontStyle: "italic",
    fontSize: "0.75rem",
  },
  education: {
    fontStyle: "italic",
    fontSize: NORMAL_FONT_SIZE,
  },
  flexRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginTop: "4px",
    marginBottom: "2px",
  },
  skills: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap", // Allows items to move to the next line
    width: "100%",
  },
  skillItem: {
    width: "20%", // Exactly 1/5th of the container width
    fontSize: NORMAL_FONT_SIZE,
    marginTop: "4px",
  },
});

const references = [
  "abhik.raya01@gmail.com",
  "+918584063964",
  "Hyderabad, TG",
  "https://www.linkedin.com/in/abhik-ray01/",
  "https://abhik-ray.github.io/portfolio/",
];

const decorateExperience = (experience: string[]) => {
  return experience.map((exp) => "• " + exp).join("\n");
};

export const MyDocument: FC<I_PdfProps> = (props) => (
  <Document
    title="Abhik Ray Resume"
    author="Abhik Ray"
    subject="Resume"
    language="en-us"
  >
    <Page size="A4" style={styles.page}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text>ABHIK RAY</Text>
          <View style={styles.references}>
            {references
              .flatMap((r, idx, arr) =>
                idx !== arr.length - 1 ? [r, " • "] : r,
              )
              .map((r) => (
                <Text>{r}</Text>
              ))}
          </View>
        </View>
        <View>
          <Text style={styles.heading}>SUMMARY</Text>
          <Text style={styles.summary}>{props.summaryData}</Text>
        </View>
        <View>
          <Text style={styles.heading}>EXPERIENCE</Text>
          {ExperienceData.map((exp, idx) => (
            <View style={styles.experience} key={idx}>
              <View style={styles.flexRow}>
                <Text style={styles.companyDetails}>{exp.companyName}, </Text>
                <Text style={styles.positionDetails}>{exp.position}</Text>
              </View>
              <Text>{exp.range}</Text>
              <Text>
                {exp.canTweak && props.mainExperienceData
                  ? decorateExperience(props.mainExperienceData)
                  : exp.description}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.education}>
          <Text style={styles.heading}>EDUCATION</Text>
          <Text>KIIT</Text>
          <View style={styles.flexRow}>
            <Text>Bachelor of Technology • </Text> <Text>Computer Science</Text>
          </View>
        </View>
        <View>
          <Text style={styles.heading}>SKILLS</Text>
          <View style={styles.skills}>
            {props.skillsData.map((s, idx) => (
              <View key={idx} style={styles.skillItem}>
                <Text>• {s}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Page>
  </Document>
);
