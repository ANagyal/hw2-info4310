# Adapted from Professor Jeff Rzeszotarski's post-process.py script for HW1

import csv
import collections
from datetime import date

def passes_filter(row):
    # Filter out all the rows with no valid release_date
    if len(row['total_sales']) < 1:
        return False
    if len(row['release_date']) < 1:
        return False
    # Only include years 1985 - 2018
    release_year = date.fromisoformat(row['release_date']).year
    if release_year < 1985 or release_year > 2018:
        return False
    return True

# import and run passes_filter
data = []
header = []
with open('dataset/vgchartz_3d.csv','r') as f:
    reader = csv.DictReader(f)
    
    header = reader.fieldnames
    for row in reader:
        if passes_filter(row):
            data.append(row)
            
print(len(data))

# export to new CSV       
with open('dataset/vgchartz_3d_FILTERED.csv','w') as f:
    writer = csv.DictWriter(f, fieldnames=header)
    writer.writeheader()
    writer.writerows(data)
