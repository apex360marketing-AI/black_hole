#!/usr/bin/env python3
"""Generate a completed BC Residential Tenancy Agreement (RTB-1 style), 2026."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

OUT = "BC_Residential_Tenancy_Agreement_2026_Wokoeck_Christensen.pdf"

styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1x', parent=styles['Title'], fontSize=15, spaceAfter=2, alignment=TA_CENTER)
SUB = ParagraphStyle('SUBx', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
                     textColor=colors.HexColor('#444444'), spaceAfter=10)
SEC = ParagraphStyle('SECx', parent=styles['Heading2'], fontSize=11.5, spaceBefore=12,
                     spaceAfter=4, textColor=colors.HexColor('#1a3a5c'))
BODY = ParagraphStyle('BODYx', parent=styles['Normal'], fontSize=9.5, leading=13, spaceAfter=5)
SMALL = ParagraphStyle('SMALLx', parent=styles['Normal'], fontSize=8.5, leading=11.5, spaceAfter=4)
LBL = ParagraphStyle('LBLx', parent=styles['Normal'], fontSize=9.5, leading=13)

def field_table(rows, col_widths):
    t = Table(rows, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#999999')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eef2f6')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

story = []

story.append(Paragraph("RESIDENTIAL TENANCY AGREEMENT", H1))
story.append(Paragraph("Province of British Columbia — prepared in the form of Residential Tenancy Branch form RTB-1<br/>"
                       "This agreement is subject to the <i>Residential Tenancy Act</i> (BC) and its regulations.", SUB))

# ---------------------------------------------------------------- Part 1
story.append(Paragraph("1. THE PARTIES TO THIS AGREEMENT", SEC))
story.append(field_table([
    [Paragraph("<b>Landlord(s)</b>", LBL),
     Paragraph("Janis Wokoeck and Alan Wokoeck", LBL)],
    [Paragraph("<b>Tenant(s)</b>", LBL),
     Paragraph("Jeremy Christensen", LBL)],
], [1.7 * inch, 5.1 * inch]))
story.append(Spacer(1, 6))

story.append(Paragraph("2. ADDRESS OF THE RENTAL UNIT", SEC))
story.append(field_table([
    [Paragraph("<b>Rental unit address</b>", LBL),
     Paragraph("3341 Broadview Road, West Kelowna, British Columbia&nbsp;&nbsp;V4T 1N1", LBL)],
], [1.7 * inch, 5.1 * inch]))
story.append(Spacer(1, 6))

story.append(Paragraph("3. ADDRESS FOR SERVICE AND CONTACT INFORMATION OF THE LANDLORD", SEC))
story.append(field_table([
    [Paragraph("<b>Address for service</b>", LBL),
     Paragraph("114 Meadowland Way, Spruce Grove, Alberta&nbsp;&nbsp;T7X 0S4", LBL)],
    [Paragraph("<b>Daytime phone</b>", LBL), Paragraph("778-215-9383 (Alan Wokoeck)", LBL)],
    [Paragraph("<b>Other phone / email</b>", LBL), Paragraph("_______________________________", LBL)],
], [1.7 * inch, 5.1 * inch]))
story.append(Spacer(1, 6))

# ---------------------------------------------------------------- Tenancy
story.append(Paragraph("4. LENGTH OF THE TENANCY", SEC))
story.append(Paragraph(
    "This tenancy starts on: <b>________________________, 2026</b> (day / month / year)", BODY))
story.append(Paragraph("This tenancy is (check one):", BODY))
story.append(Paragraph(
    "<b>[&nbsp;&nbsp;]</b>&nbsp; (a) on a month-to-month basis"
    "<br/><b>[X]</b>&nbsp; (b) for a fixed term of <b>three (3) months</b>, ending on "
    "<b>________________________, 2026</b>", BODY))
story.append(Paragraph(
    "At the end of the fixed term (check one):"
    "<br/><b>[X]</b>&nbsp; (c) the tenancy will continue on a <b>month-to-month</b> basis, or another "
    "fixed-term length, unless the tenant gives notice to end the tenancy at least one clear month "
    "before the end of the term;"
    "<br/><b>[&nbsp;&nbsp;]</b>&nbsp; (d) the tenancy ends and the tenant must vacate the rental unit. "
    "(Only permitted in circumstances prescribed under section 13.1 of the Residential Tenancy "
    "Regulation. Reason: not applicable — clause (c) applies.)", BODY))
story.append(Spacer(1, 4))

story.append(Paragraph("5. RENT", SEC))
story.append(Paragraph(
    "(a) Payment of rent: The tenant will pay rent of <b>$1,600.00</b> per month to the landlord on the "
    "<b>first (1st) day of each month</b>, subject to rent increases given in accordance with the "
    "<i>Residential Tenancy Act</i>.", BODY))
story.append(Paragraph("(b) The following are included in the rent (checked items are included):", BODY))
inc = [
    ("[X]", "Water"), ("[X]", "Electricity"), ("[X]", "Heat"),
    ("[X]", "Sewage disposal"), ("[X]", "Garbage collection"), ("[X]", "Natural gas (if applicable)"),
    ("[ ]", "Cablevision"), ("[ ]", "Internet"), ("[ ]", "Snow removal"),
    ("[X]", "Stove and oven"), ("[X]", "Refrigerator"), ("[ ]", "Dishwasher"),
    ("[ ]", "Furniture"), ("[ ]", "Laundry (free)"), ("[ ]", "Parking for ____ vehicle(s)"),
]
rows, r = [], []
for chk, label in inc:
    r.append(Paragraph(f"<b>{chk}</b>&nbsp;{label}", SMALL))
    if len(r) == 3:
        rows.append(r); r = []
if r:
    while len(r) < 3: r.append(Paragraph("", SMALL))
    rows.append(r)
t = Table(rows, colWidths=[2.27 * inch] * 3)
t.setStyle(TableStyle([
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 1),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
]))
story.append(t)
story.append(Paragraph(
    "Additional information: <b>All utilities are included in the monthly rent.</b>", BODY))
story.append(Spacer(1, 4))

story.append(Paragraph("6. SECURITY DEPOSIT AND PET DAMAGE DEPOSIT", SEC))
story.append(Paragraph(
    "(a) The tenant is required to pay a <b>security deposit of $800.00</b> on or before "
    "________________________, 2026.", BODY))
story.append(Paragraph(
    "(b) The tenant is permitted to keep a pet (one dog) and is required to pay a "
    "<b>pet damage deposit of $800.00</b> on or before ________________________, 2026.", BODY))
story.append(Paragraph(
    "The landlord agrees that each deposit does not exceed one half of one month's rent, as required by "
    "the <i>Residential Tenancy Act</i>, and will not be increased if the rent is increased. The landlord "
    "must repay a deposit with interest as set out in the Act, or claim against it, within 15 days of the "
    "later of the end of the tenancy and the date the landlord receives the tenant's forwarding address in "
    "writing, unless the tenant agrees in writing that the landlord may keep some or all of it, or the "
    "landlord applies for dispute resolution. Otherwise the landlord must pay the tenant double the "
    "deposit(s).", SMALL))
story.append(Spacer(1, 4))

story.append(Paragraph("7. PETS", SEC))
story.append(Paragraph(
    "The tenant has a dog, which the landlord permits under this agreement. Any pet must be kept in "
    "compliance with applicable bylaws and any reasonable pet-related rules in the attached addendum. "
    "The tenant is responsible for any damage caused by the pet.", BODY))

story.append(Paragraph("8. ADDENDUM", SEC))
story.append(Paragraph(
    "<b>[X]</b>&nbsp; An addendum is attached to and forms part of this tenancy agreement. "
    "Number of pages: ______&nbsp;&nbsp;Number of additional terms: ______<br/>"
    "Both the landlord and the tenant must initial each page of the addendum. Any term of this "
    "agreement or the addendum that is inconsistent with the <i>Residential Tenancy Act</i> or "
    "regulations is void and unenforceable.", BODY))

story.append(PageBreak())

# ---------------------------------------------------------------- Standard terms
story.append(Paragraph("STANDARD TERMS", H1))
story.append(Paragraph("These terms follow the standard terms of form RTB-1 under the "
                       "<i>Residential Tenancy Act</i> (BC).", SUB))

terms = [
    ("1. Application of the Residential Tenancy Act",
     "The terms of this tenancy agreement and any changes or additions to it must comply with the "
     "Residential Tenancy Act and regulations. If a term does not comply, it is void. Any change or "
     "addition to this agreement must be agreed to in writing and initialled by both the landlord and "
     "the tenant, and must be reasonable. The landlord must give the tenant a copy of this agreement "
     "promptly, and in any event within 21 days of entering into the agreement."),
    ("2. Security deposit and pet damage deposit",
     "The tenant must pay the security deposit and any pet damage deposit as set out in section 6 above. "
     "The landlord must not require a security deposit or pet damage deposit greater than half of the "
     "monthly rent, and must not require the tenant to pay both deposits totalling more than one "
     "month's rent. The right of the tenant to the return of a deposit may be affected by failing to "
     "participate in a condition inspection or failing to provide a forwarding address in writing "
     "within one year of the end of the tenancy."),
    ("3. Condition inspections",
     "The landlord and tenant must inspect the condition of the rental unit together at the start and "
     "end of the tenancy, and when a pet damage deposit is first collected part-way through a tenancy. "
     "The landlord must complete a condition inspection report (form RTB-27) at each inspection and "
     "give the tenant a copy. The right of the landlord to claim against a deposit, or of the tenant to "
     "its return, may be extinguished by failing to meet inspection obligations under the Act."),
    ("4. Payment of rent",
     "The tenant must pay the rent on time. If rent is unpaid, the landlord may issue a notice to end "
     "the tenancy, which may take effect not earlier than 10 days after the notice is given. The "
     "landlord must give the tenant a receipt for rent paid in cash. The landlord must return any "
     "post-dated cheques remaining at the end of the tenancy. The tenant may deduct from rent only "
     "amounts the landlord has agreed to in writing or an arbitrator has ordered may be deducted."),
    ("5. Rent increases",
     "Once every 12 months the landlord may increase the rent for the current tenant. The landlord may "
     "only increase the rent 12 months after the date the existing rent was established or last "
     "increased. The landlord must use the approved notice-of-rent-increase form and give the tenant "
     "at least 3 whole months' notice. The increase must not exceed the amount permitted under the "
     "regulation, unless the tenant agrees in writing or an arbitrator orders otherwise."),
    ("6. Assign or sublet",
     "The tenant may assign or sublet the rental unit with the landlord's written consent. If this "
     "tenancy is for a fixed term of 6 months or more, the landlord must not unreasonably withhold "
     "consent. Under an assignment, a new tenant takes over the rights and obligations under this "
     "agreement, with the landlord's consent."),
    ("7. Repairs",
     "Landlord's obligations: The landlord must provide and maintain the rental unit in a reasonable "
     "state of decoration and repair, complying with health, safety and housing standards required by "
     "law, and making it suitable for occupation. Tenant's obligations: The tenant must maintain "
     "reasonable health, cleanliness and sanitary standards throughout the rental unit and property, "
     "and must repair damage caused by the actions or neglect of the tenant, the tenant's pet, or "
     "persons permitted on the property by the tenant. The tenant is not responsible for reasonable "
     "wear and tear. Emergency repairs: The landlord must post and maintain the name and phone number "
     "of the designated contact for emergency repairs. The tenant may have emergency repairs made "
     "(major leaks, blocked sewer, damaged locks, defective heat/plumbing/electricity, etc.) only when "
     "the tenant has made at least two attempts to reach the designated contact and given a reasonable "
     "time for the repairs to be made."),
    ("8. Occupants and guests",
     "The landlord must not stop the tenant from having guests under reasonable circumstances, and "
     "must not impose restrictions or charges on guests. If the number of permanent occupants becomes "
     "unreasonable, the landlord may discuss the issue with the tenant and may serve a notice to end "
     "the tenancy; disputes may be resolved through the Residential Tenancy Branch."),
    ("9. Locks",
     "Neither the landlord nor the tenant may change or add locks to the rental unit unless both "
     "agree, or an arbitrator has ordered otherwise. At the start of the tenancy the landlord must "
     "give the tenant keys or other means of access to the rental unit, and must not charge a fee "
     "for replacement keys unless the replacement is required because of a tenant's fault."),
    ("10. Landlord's entry into the rental unit",
     "For the duration of this tenancy agreement, the rental unit is the tenant's home and the tenant "
     "is entitled to quiet enjoyment, reasonable privacy, and freedom from unreasonable disturbance. "
     "The landlord may enter the rental unit only if: the tenant consents at the time of entry; the "
     "landlord has given at least 24 hours' and not more than 30 days' written notice stating a "
     "reasonable purpose and a time between 8 a.m. and 9 p.m. (unless the tenant agrees otherwise); "
     "there is an emergency and entry is necessary to protect life or property; the tenant has "
     "abandoned the unit; the landlord provides housekeeping or related services and enters at a "
     "reasonable agreed time; or an arbitrator has ordered entry."),
    ("11. Ending the tenancy",
     "The tenant may end a month-to-month tenancy by giving the landlord at least one clear month's "
     "written notice (received before the day rent is due, effective the last day of the following "
     "month). A fixed-term tenancy may not be ended by the tenant effective earlier than the end date "
     "of the term, except as the Act permits. The landlord may end the tenancy only for the reasons "
     "and by the process set out in the Residential Tenancy Act, using the approved notice forms. "
     "The landlord and tenant may also mutually agree in writing to end this tenancy agreement at any "
     "time. The tenant must vacate by 1 p.m. on the day the tenancy ends, unless agreed otherwise."),
    ("12. Resolving disputes",
     "Either party may apply to the Residential Tenancy Branch for dispute resolution under the "
     "Residential Tenancy Act. Information: 1-800-665-8779 or gov.bc.ca/landlordtenant."),
]
for title, text in terms:
    story.append(KeepTogether([Paragraph(title, SEC), Paragraph(text, SMALL)]))

story.append(PageBreak())

# ---------------------------------------------------------------- Signatures
story.append(Paragraph("SIGNATURES", H1))
story.append(Paragraph(
    "By signing this tenancy agreement, the landlord and the tenant are bound by its terms. "
    "The tenant acknowledges receiving a copy of this agreement, including the attached addendum.", BODY))
story.append(Spacer(1, 18))

def sig_block(role, name):
    return [
        Paragraph(f"<b>{role}</b>", BODY),
        Spacer(1, 26),
        Table([[Paragraph("_________________________________", LBL),
                Paragraph("_________________________________", LBL)],
               [Paragraph(f"Signature — {name}", SMALL),
                Paragraph("Date (day / month / year)", SMALL)]],
              colWidths=[3.4 * inch, 3.4 * inch],
              style=TableStyle([('TOPPADDING', (0, 0), (-1, -1), 1),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 1)])),
        Spacer(1, 16),
    ]

for role, name in [("Landlord", "Janis Wokoeck"),
                   ("Landlord", "Alan Wokoeck"),
                   ("Tenant", "Jeremy Christensen")]:
    story.append(KeepTogether(sig_block(role, name)))

story.append(Spacer(1, 10))
story.append(Paragraph(
    "Note: The landlord must give the tenant a copy of this agreement within 21 days of entering "
    "into it. For more information about rights and obligations under the Residential Tenancy Act, "
    "contact the Residential Tenancy Branch: 1-800-665-8779 | gov.bc.ca/landlordtenant", SMALL))

story.append(PageBreak())

# ---------------------------------------------------------------- Addendum
story.append(Paragraph("ADDENDUM TO RESIDENTIAL TENANCY AGREEMENT", H1))
story.append(Paragraph("This addendum is attached to and forms part of the residential tenancy agreement "
                       "between the parties below.", SUB))
story.append(field_table([
    [Paragraph("<b>Landlord(s)</b>", LBL), Paragraph("Janis Wokoeck and Alan Wokoeck", LBL)],
    [Paragraph("<b>Tenant(s)</b>", LBL), Paragraph("Jeremy Christensen", LBL)],
    [Paragraph("<b>Rental unit</b>", LBL),
     Paragraph("3341 Broadview Road, West Kelowna, BC&nbsp;&nbsp;V4T 1N1", LBL)],
], [1.7 * inch, 5.1 * inch]))
story.append(Spacer(1, 8))
story.append(Paragraph("Additional terms (each term must comply with the <i>Residential Tenancy Act</i>; "
                       "terms that are inconsistent with the Act are void):", BODY))
for i in range(1, 9):
    story.append(Paragraph(f"{i}. ________________________________________________________________"
                           "____________________", BODY))
    story.append(Spacer(1, 8))
story.append(Spacer(1, 14))
story.append(Table([[Paragraph("____________________________", LBL),
                     Paragraph("____________________________", LBL),
                     Paragraph("____________________________", LBL)],
                    [Paragraph("Landlord's initials", SMALL),
                     Paragraph("Landlord's initials", SMALL),
                     Paragraph("Tenant's initials", SMALL)]],
                   colWidths=[2.27 * inch] * 3,
                   style=TableStyle([('TOPPADDING', (0, 0), (-1, -1), 1)])))

doc = SimpleDocTemplate(OUT, pagesize=letter,
                        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
                        title="Residential Tenancy Agreement — 3341 Broadview Road, West Kelowna BC",
                        author="Janis and Alan Wokoeck")
doc.build(story)
print("wrote", OUT)
