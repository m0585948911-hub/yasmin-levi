
export type BusinessDetails = {
    businessName: string;
    firstName: string;
    lastName: string;
    gender: 'male' | 'female';
    email: string;
    street: string;
    houseNumber: string;
    city: string;
    phone: string;
}

export type AppLinks = {
    facebook: string;
    instagram: string;
    tiktok: string;
    website: string;
}

export type AppTheme = {
    primary: string;
    background: string;
    foreground: string;
    accent: string;
}

export type CalendarSettings = {
    checkInterval: number;
    recheckInterval: number;
    adhesionDuration: number;
    isFlexible: boolean;
}

export type LimitationSettings = {
    newAppointmentDaysLimit: number;
    newAppointmentHoursLimit: number;
    editAppointmentHoursLimit: number;
    cancelAppointmentHoursLimit: number;
    requireApprovalOnLimit: boolean;
}

export type BlockedClientSettings = {
    blockingMethod: 'approval' | 'login';
}

export type RegistrationSettings = {
    requireBirthDate: boolean;
    requireEmail: boolean;
    requirePrepayment: boolean;
}

export type GeneralAppSettings = {
    isArrivalConfirmationActive: boolean;
    isWaitingListActive: boolean;
    showPrice: boolean;
    showDuration: boolean;
    restrictToIsraeliNumbers: boolean;
    hideGraySlots: boolean;
    noPriorityCalendar: boolean;
    allowMultiServiceSelection: boolean;
    allowEditAppointment: boolean;
    allowCancelAppointment: boolean;
    requireTermsSignature: boolean;
    termsAndConditions: string;
    appointmentApproval?: 'manager' | 'all';
}

export type AppointmentNotificationSetting = {
    enabled: boolean;
    content: string;
};

export type AppointmentNotifications = {
    newAppointment?: AppointmentNotificationSetting;
    dayBefore?: AppointmentNotificationSetting;
    timeToLeave?: AppointmentNotificationSetting;
    afterAppointment?: AppointmentNotificationSetting;
    rejection?: AppointmentNotificationSetting;
};

export type AllSettings = {
    businessDetails: BusinessDetails;
    appLinks: AppLinks;
    appTheme: AppTheme;
    calendarSettings: CalendarSettings;
    limitationSettings: LimitationSettings;
    blockedClientSettings: BlockedClientSettings;
    registrationSettings: RegistrationSettings;
    generalAppSettings: GeneralAppSettings;
    appointmentNotifications: AppointmentNotifications;
};
