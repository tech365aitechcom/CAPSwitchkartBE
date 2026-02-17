// Utility functions for questionnaire controller

export const convertGrade = (grade) => {
  const grades = {
    "A+": "A_PLUS",
    A: "A",
    "A-": "A_MINUS",
    "A-Limited": "A_MINUS_LIMITED",
    "B+": "B_PLUS",
    B: "B",
    "B-": "B_MINUS",
    "B-Limited": "B_MINUS_LIMITED",
    "C+": "C_PLUS",
    C: "C",
    "C-": "C_MINUS",
    "C-Limited": "C_MINUS_LIMITED",
    "D+": "D_PLUS",
    D: "D",
    "D-": "D_MINUS",
    E: "E",
  };
  return grades[grade];
};

export const maskPhoneNumber = (phNumber, shouldMask) => {
  if (!shouldMask) {
    return phNumber;
  }

  const visibleLength = Math.ceil(phNumber?.length * 0.25);
  const maskedSection = phNumber?.slice(0, phNumber.length - visibleLength);
  const visibleSection = phNumber?.slice(phNumber?.length - visibleLength);
  return `${maskedSection.replace(/./g, "x")}${visibleSection}`;
};

export const maskEmail = (email, shouldMask) => {
  if (!shouldMask) {
    return email;
  }
  if (!email) {
    return ''
  }

  const [namee, domain] = email.split("@");
  const visibleLength = Math.ceil(namee?.length * 0.25);
  const maskedName = namee?.slice(0, namee?.length - visibleLength);
  const visibleName = namee?.slice(namee?.length - visibleLength);
  return `${maskedName.replace(/./g, "x")}${visibleName}@${domain}`;
};

export const validateLeadAndUser = (lead, userId) => {
  return lead && lead.userId._id.toString() === userId;
};

export const prepareRAMStorageLabel = (RAM, storage) => {
  if (!RAM && !storage) {
    return "";
  }
  const parts = [RAM, storage].filter(Boolean);
  return `(${parts.join("/")})`;
};

export const getFormattedDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function fillTemplate(template, data) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    return data[key.trim()] ?? "";
  });
}

export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function generateStorePrefix(req) {
  const input = req?.storeName || "Switchkart";

  // Remove special characters and keep only letters, numbers, and spaces
  const cleaned = input.replace(/[^a-zA-Z0-9\s]/g, "");

  return cleaned
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function extractCodeNumber(code) {
  if (!code) {
    return 0;
  }
  const numbers = code.match(/\d+/g);
  return numbers ? Number(numbers[0]) : 0;
}

export function prepareLeadDefaults(obj) {
  obj.bonusPrice = 0;
  obj.ram = obj.ram || "NA";
  obj.storage = obj.storage || "NA";
  obj.createdAt = new Date();
}

export function shouldRetry(error, retries) {
  return error.code === 11000 && error.keyPattern?.uniqueCode && retries > 0;
}

// QNA Helper Functions
export function DisplayCodeUpd(QNA, query, DISPLAY1, DISPLAY2, DISPLAY3) {
  let display = QNA?.Display
    ? QNA.Display.filter((e) => e.answer === DISPLAY3)
    : [];
  query.displayCode = DISPLAY3;
  if (!display.length) {
    display = QNA.Display.filter((e) => e.answer === DISPLAY2);
    query.displayCode = DISPLAY2;
    if (!display.length) {
      QNA.Display.filter((e) => e.answer === DISPLAY1);
      query.displayCode = DISPLAY1;
    }
  }
}

export function FuncMajorUpd(
  QNA,
  query,
  FUNCTIONAL_MAJOR1,
  FUNCTIONAL_MAJOR2,
  FUNCTIONAL_MAJOR3
) {
  let functionalMajor = QNA?.Functional_major
    ? QNA.Functional_major.filter(
        (e) => e.answer === FUNCTIONAL_MAJOR3 && e.key === "yes"
      )
    : [];
  query.functionalMajorCode = FUNCTIONAL_MAJOR3;
  if (!functionalMajor.length) {
    functionalMajor = QNA.Functional_major.filter(
      (e) => e.answer === FUNCTIONAL_MAJOR2 && e.key === "yes"
    );
    query.functionalMajorCode = FUNCTIONAL_MAJOR2;
    if (!functionalMajor.length) {
      QNA.Functional_major.filter(
        (e) => e.answer === FUNCTIONAL_MAJOR1 && e.key === "yes"
      );
      query.functionalMajorCode = FUNCTIONAL_MAJOR1;
    }
  }
}

export function FuncMinorUpd(
  QNA,
  query,
  FUNCTIONAL_MINOR1,
  FUNCTIONAL_MINOR2,
  FUNCTIONAL_MINOR3
) {
  let functionalMinor = QNA?.Functional_minor
    ? QNA.Functional_minor.filter(
        (e) => e.answer === FUNCTIONAL_MINOR3 && e.key === "yes"
      )
    : [];
  query.functionalMinorCode = FUNCTIONAL_MINOR3;
  if (!functionalMinor.length) {
    functionalMinor = QNA.Functional_minor.filter(
      (e) => e.answer === FUNCTIONAL_MINOR2 && e.key === "yes"
    );
    query.functionalMinorCode = FUNCTIONAL_MINOR2;
    if (!functionalMinor.length) {
      QNA.Functional_minor.filter(
        (e) => e.answer === FUNCTIONAL_MINOR1 && e.key === "yes"
      );
      query.functionalMinorCode = FUNCTIONAL_MINOR1;
    }
  }
}

export function CosmeticsUpd(
  QNA,
  query,
  COSMETICS1,
  COSMETICS2,
  COSMETICS3,
  COSMETICS4
) {
  let cosmetics = QNA?.Cosmetics
    ? QNA.Cosmetics.filter((e) => e.answer === COSMETICS4)
    : [];
  query.cosmeticsCode = COSMETICS4;
  if (!cosmetics.length) {
    cosmetics = QNA.Cosmetics.filter((e) => e.answer === COSMETICS3);
    query.cosmeticsCode = COSMETICS3;
    if (!cosmetics.length) {
      cosmetics = QNA.Cosmetics.filter((e) => e.answer === COSMETICS2);
      query.cosmeticsCode = COSMETICS2;
      if (!cosmetics.length) {
        QNA.Cosmetics.filter((e) => e.answer === COSMETICS1);
        query.cosmeticsCode = COSMETICS1;
      }
    }
  }
}

export function FunctionalUpd(
  QNA,
  query,
  FUNCTIONAL_MAJOR1,
  FUNCTIONAL_MAJOR1_1
) {
  const functional = QNA?.Functional
    ? QNA.Functional.filter((e) => e.answer === FUNCTIONAL_MAJOR1)
    : [];
  query.functionalCode = FUNCTIONAL_MAJOR1;
  if (!functional.length) {
    query.functionalCode = FUNCTIONAL_MAJOR1_1;
  }
}

export function FunctionalIPADUpd(
  QNA,
  query,
  FUNCTIONAL_MAJOR1,
  FUNCTIONAL_MAJOR2
) {
  const functional = QNA?.Functional
    ? QNA.Functional.filter((e) => e.answer === FUNCTIONAL_MAJOR2)
    : [];
  query.functionalCode = FUNCTIONAL_MAJOR2;
  if (!functional.length) {
    query.functionalCode = FUNCTIONAL_MAJOR1;
  }
}

export function PhysicalUpd(
  QNA,
  query,
  COSMETICS1,
  COSMETICS2,
  COSMETICS3,
  COSMETICS4
) {
  let physical = QNA?.Physical
    ? QNA.Physical.filter((e) => e.answer === COSMETICS4)
    : [];
  query.cosmeticsCode = COSMETICS4;
  if (!physical.length) {
    physical = QNA.Physical.filter((e) => e.answer === COSMETICS3);
    query.cosmeticsCode = COSMETICS3;
    if (!physical.length) {
      physical = QNA.Physical.filter((e) => e.answer === COSMETICS2);
      query.cosmeticsCode = COSMETICS2;
      if (!physical.length) {
        query.cosmeticsCode = COSMETICS1;
      }
    }
  }
}

export function AccessoriesUpd(
  QNA,
  query,
  ACCESSORIES1,
  ACCESSORIES2,
  ACCESSORIES3
) {
  let accessories = QNA?.Accessories
    ? QNA.Accessories.filter((e) => e.answer === ACCESSORIES3)
    : [];
  query.accessoriesCode = ACCESSORIES3;

  if (!accessories.length) {
    accessories = QNA.Accessories.filter((e) => e.answer === ACCESSORIES1);
    query.accessoriesCode = ACCESSORIES1;
    if (!accessories.length) {
      query.accessoriesCode = ACCESSORIES2;
    }
  }
}
