import sys

with open('f:/My Projects/ServiceSync/frontend/src/pages/technician/TechDonorDevices.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('TechDonorDevices', 'TechSalvageDevices')
content = content.replace('Donor Devices', 'Salvage Devices')
content = content.replace('Donor Device', 'Salvage Device')
content = content.replace('donor device', 'salvage device')
content = content.replace('d.source !== "unclaimed_job"', 'd.source === "unclaimed_job"')

with open('f:/My Projects/ServiceSync/frontend/src/pages/technician/TechSalvageDevices.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Success')
