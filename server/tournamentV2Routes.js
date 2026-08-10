const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { randomUUID } = require('crypto');

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==========================================
// TOURNAMENTS
// ==========================================

// GET all V2 tournaments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v2_tournaments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("GET /tournaments-v2 error:", err);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

// POST new tournament
router.post('/', async (req, res) => {
  try {
    const { name, date, time, status } = req.body;
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO v2_tournaments (id, name, date, time, status) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, name, date, time, status || 'Active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /tournaments-v2 error:", err);
    res.status(500).json({ error: "Failed to create tournament" });
  }
});

// PUT edit tournament
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, time, status } = req.body;
    const result = await pool.query(
      `UPDATE v2_tournaments SET name = $1, date = $2, time = $3, status = $4 WHERE id = $5 RETURNING *`,
      [name, date, time, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /tournaments-v2 error:", err);
    res.status(500).json({ error: "Failed to update tournament" });
  }
});

// DELETE tournament
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM v2_tournaments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /tournaments-v2 error:", err);
    res.status(500).json({ error: "Failed to delete tournament" });
  }
});

// ==========================================
// DIVISIONS
// ==========================================

router.get('/:tournamentId/divisions', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const result = await pool.query('SELECT * FROM v2_divisions WHERE tournament_id = $1 ORDER BY created_at ASC', [tournamentId]);
    res.json(result.rows);
  } catch (err) {
    console.error("GET divisions error:", err);
    res.status(500).json({ error: "Failed to fetch divisions" });
  }
});

router.post('/:tournamentId/divisions', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { name, gender, skill_level } = req.body;
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO v2_divisions (id, tournament_id, name, gender, skill_level) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, tournamentId, name, gender, skill_level]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST division error:", err);
    res.status(500).json({ error: "Failed to create division" });
  }
});

// PUT edit division
router.put('/divisions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, skill_level } = req.body;
    const result = await pool.query(
      `UPDATE v2_divisions SET name = $1, gender = $2, skill_level = $3 WHERE id = $4 RETURNING *`,
      [name, gender, skill_level, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT division error:", err);
    res.status(500).json({ error: "Failed to update division" });
  }
});

// DELETE division
router.delete('/divisions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM v2_divisions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE division error:", err);
    res.status(500).json({ error: "Failed to delete division" });
  }
});

// ==========================================
// TEAMS
// ==========================================

router.get('/divisions/:divisionId/teams', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const result = await pool.query('SELECT * FROM v2_teams WHERE division_id = $1 ORDER BY created_at ASC', [divisionId]);
    res.json(result.rows);
  } catch (err) {
    console.error("GET teams error:", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

router.post('/divisions/:divisionId/teams', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { team_name, player1, player2, club_name } = req.body;
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO v2_teams (id, division_id, team_name, player1, player2, club_name) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, divisionId, team_name, player1, player2, club_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST team error:", err);
    res.status(500).json({ error: "Failed to register team" });
  }
});

// ==========================================
// MATCHES & BRACKET GENERATION
// ==========================================

router.get('/divisions/:divisionId/matches', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const result = await pool.query(`
      SELECT m.*, 
             tA.team_name as team_a_name, tA.player1 as ta_p1, tA.player2 as ta_p2,
             tB.team_name as team_b_name, tB.player1 as tb_p1, tB.player2 as tb_p2
      FROM v2_matches m
      LEFT JOIN v2_teams tA ON m.team_a_id = tA.id
      LEFT JOIN v2_teams tB ON m.team_b_id = tB.id
      WHERE m.division_id = $1 
      ORDER BY m.stage ASC, m.bracket_group ASC, m.match_round ASC, m.match_order ASC
    `, [divisionId]);
    res.json(result.rows);
  } catch (err) {
    console.error("GET matches error:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

router.post('/divisions/:divisionId/generate-initial', async (req, res) => {
  const client = await pool.connect();
  try {
    const { divisionId } = req.params;
    const { format, endScore, groups } = req.body;
    
    await client.query('BEGIN');
    
    // Clear existing initial matches and reset team stats for this division
    await client.query("DELETE FROM v2_matches WHERE division_id = $1 AND stage = 'initial'", [divisionId]);
    await client.query("UPDATE v2_teams SET wins = 0, losses = 0, point_diff = 0 WHERE division_id = $1", [divisionId]);
    
    const teamsRes = await client.query('SELECT * FROM v2_teams WHERE division_id = $1 ORDER BY created_at ASC', [divisionId]);
    let teams = teamsRes.rows;
    
    if (teams.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Need at least 2 teams to generate a bracket." });
    }

    let matchesToInsert = [];
    
    if (format === 'Round Robin') {
      const numGroups = parseInt(groups, 10) || 1;
      // Distribute teams into groups
      const groupAssignments = Array.from({ length: numGroups }, () => []);
      teams.forEach((t, i) => groupAssignments[i % numGroups].push(t));
      
      groupAssignments.forEach((groupTeams, gIndex) => {
        // Generate round robin matches for groupTeams
        if (groupTeams.length < 2) return;
        
        let roundTeams = [...groupTeams];
        // Add a dummy if odd
        if (roundTeams.length % 2 !== 0) {
          roundTeams.push(null);
        }
        const totalRounds = roundTeams.length - 1;
        const matchesPerRound = roundTeams.length / 2;
        
        for (let round = 0; round < totalRounds; round++) {
          for (let m = 0; m < matchesPerRound; m++) {
            const teamA = roundTeams[m];
            const teamB = roundTeams[roundTeams.length - 1 - m];
            if (teamA !== null && teamB !== null) {
              matchesToInsert.push({
                id: randomUUID(),
                division_id: divisionId,
                stage: 'initial',
                bracket_group: gIndex + 1,
                match_round: round + 1,
                match_order: m + 1,
                team_a_id: teamA.id,
                team_b_id: teamB.id,
                otp: generateOTP(),
                match_type: 'Pool Play'
              });
            }
          }
          // Rotate teams (keep first fixed)
          const lastTeam = roundTeams.pop();
          roundTeams.splice(1, 0, lastTeam);
        }
      });
    } else {
      // Single Elimination Logic (Basic implementation for Initial Stage if chosen over RR)
      // For a more complete implementation we build a proper tree.
      // E.g. pad to power of 2 with nulls (byes).
      const numTeams = teams.length;
      let power = 1;
      while (power < numTeams) power *= 2;
      const byes = power - numTeams;
      
      let firstRoundTeams = [];
      let teamIdx = 0;
      for (let i = 0; i < power; i++) {
        if (i < byes) {
           firstRoundTeams.push(teams[teamIdx++]);
           firstRoundTeams.push(null);
        } else {
           if (teamIdx < numTeams) firstRoundTeams.push(teams[teamIdx++]);
           if (teamIdx < numTeams) firstRoundTeams.push(teams[teamIdx++]);
        }
      }
      
      let currentRoundNodes = [];
      let mOrder = 1;
      for(let i=0; i<firstRoundTeams.length; i+=2) {
         let teamA = firstRoundTeams[i];
         let teamB = firstRoundTeams[i+1];
         let m = {
            id: randomUUID(),
            division_id: divisionId,
            stage: 'initial',
            bracket_group: 1,
            match_round: 1,
            match_order: mOrder++,
            team_a_id: teamA ? teamA.id : null,
            team_b_id: teamB ? teamB.id : null,
            otp: generateOTP(),
            match_type: 'Elimination R1'
         };
         // If there's a bye, auto advance
         if (!teamB && teamA) {
            m.status = 'Completed';
            m.winner_id = teamA.id;
         }
         matchesToInsert.push(m);
         currentRoundNodes.push(m);
      }
      
      let currentRoundNum = 2;
      while (currentRoundNodes.length > 1) {
         let nextRoundNodes = [];
         mOrder = 1;
         for (let i=0; i<currentRoundNodes.length; i+=2) {
            let m1 = currentRoundNodes[i];
            let m2 = currentRoundNodes[i+1];
            let newM = {
               id: randomUUID(),
               division_id: divisionId,
               stage: 'initial',
               bracket_group: 1,
               match_round: currentRoundNum,
               match_order: mOrder++,
               team_a_id: m1.winner_id || null, // Might be known if bye
               team_b_id: m2.winner_id || null,
               otp: generateOTP(),
               match_type: currentRoundNodes.length === 2 ? 'Final' : 'Elimination'
            };
            m1.next_match_id = newM.id;
            m2.next_match_id = newM.id;
            matchesToInsert.push(newM);
            nextRoundNodes.push(newM);
         }
         currentRoundNodes = nextRoundNodes;
         currentRoundNum++;
      }
    }

    for (let m of matchesToInsert) {
       await client.query(`
         INSERT INTO v2_matches (id, division_id, stage, bracket_group, match_round, match_order, team_a_id, team_b_id, otp, match_type, status, winner_id, next_match_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       `, [m.id, m.division_id, m.stage, m.bracket_group, m.match_round, m.match_order, m.team_a_id, m.team_b_id, m.otp, m.match_type, m.status || 'Pending', m.winner_id || null, m.next_match_id || null]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true, count: matchesToInsert.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Generate initial bracket error:", err);
    res.status(500).json({ error: "Failed to generate initial bracket" });
  } finally {
    client.release();
  }
});

// Update match score & handle auto-advancement
router.post('/matches/:matchId/score', async (req, res) => {
  const client = await pool.connect();
  try {
    const { matchId } = req.params;
    const { score_a, score_b, status, winner_id } = req.body;
    
    await client.query('BEGIN');
    
    const matchRes = await client.query('SELECT * FROM v2_matches WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) throw new Error("Match not found");
    const match = matchRes.rows[0];

    // If previously completed, we need to reverse the stats
    if (match.status === 'Completed' && match.stage === 'initial') {
       if (match.team_a_id) {
          const diffA = (match.score_a || 0) - (match.score_b || 0);
          const winA = match.winner_id === match.team_a_id ? 1 : 0;
          const lossA = match.winner_id && match.winner_id !== match.team_a_id ? 1 : 0;
          await client.query('UPDATE v2_teams SET wins = wins - $1, losses = losses - $2, point_diff = point_diff - $3 WHERE id = $4', [winA, lossA, diffA, match.team_a_id]);
       }
       if (match.team_b_id) {
          const diffB = (match.score_b || 0) - (match.score_a || 0);
          const winB = match.winner_id === match.team_b_id ? 1 : 0;
          const lossB = match.winner_id && match.winner_id !== match.team_b_id ? 1 : 0;
          await client.query('UPDATE v2_teams SET wins = wins - $1, losses = losses - $2, point_diff = point_diff - $3 WHERE id = $4', [winB, lossB, diffB, match.team_b_id]);
       }
    }

    await client.query(`
      UPDATE v2_matches 
      SET score_a = $1, score_b = $2, status = $3, winner_id = $4
      WHERE id = $5
    `, [score_a, score_b, status, winner_id, matchId]);
    
    // If completed now, apply stats and advance
    if (status === 'Completed') {
       if (match.stage === 'initial') {
          if (match.team_a_id) {
            const diffA = score_a - score_b;
            const winA = winner_id === match.team_a_id ? 1 : 0;
            const lossA = winner_id && winner_id !== match.team_a_id ? 1 : 0;
            await client.query('UPDATE v2_teams SET wins = wins + $1, losses = losses + $2, point_diff = point_diff + $3 WHERE id = $4', [winA, lossA, diffA, match.team_a_id]);
          }
          if (match.team_b_id) {
            const diffB = score_b - score_a;
            const winB = winner_id === match.team_b_id ? 1 : 0;
            const lossB = winner_id && winner_id !== match.team_b_id ? 1 : 0;
            await client.query('UPDATE v2_teams SET wins = wins + $1, losses = losses + $2, point_diff = point_diff + $3 WHERE id = $4', [winB, lossB, diffB, match.team_b_id]);
          }
       }
       
       // Advance to next match in bracket if exists
       if (match.next_match_id && winner_id) {
          // Find out if we are team A or team B for the next match
          // Simple logic: if team_a_id is null, put there, else put team_b_id
          const nextRes = await client.query('SELECT team_a_id, team_b_id FROM v2_matches WHERE id = $1', [match.next_match_id]);
          if (nextRes.rows.length > 0) {
             const nextM = nextRes.rows[0];
             // If we were team_a originally, maybe we go to a specific slot?
             // Without explicit tree slots, just fill the first empty slot.
             if (!nextM.team_a_id || nextM.team_a_id === match.team_a_id || nextM.team_a_id === match.team_b_id) {
                await client.query('UPDATE v2_matches SET team_a_id = $1 WHERE id = $2', [winner_id, match.next_match_id]);
             } else {
                await client.query('UPDATE v2_matches SET team_b_id = $1 WHERE id = $2', [winner_id, match.next_match_id]);
             }
          }
       }
    }
    
    await client.query('COMMIT');
    
    // Send SSE update
    if (global.sendTournamentSSE) {
       global.sendTournamentSSE(match.division_id, { type: 'MATCH_UPDATE', matchId });
    }
    
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Score update error:", err);
    res.status(500).json({ error: "Failed to update score" });
  } finally {
    client.release();
  }
});

router.post('/divisions/:divisionId/generate-medal', async (req, res) => {
  const client = await pool.connect();
  try {
    const { divisionId } = req.params;
    const { format, endScore, topN, hasQuarterfinals } = req.body;
    
    await client.query('BEGIN');
    await client.query("DELETE FROM v2_matches WHERE division_id = $1 AND stage = 'medal'", [divisionId]);
    
    // Get top teams from each bracket group
    const groupsRes = await client.query('SELECT DISTINCT bracket_group FROM v2_matches WHERE division_id = $1 AND stage = \'initial\'', [divisionId]);
    const groupNums = groupsRes.rows.map(r => r.bracket_group);
    
    let qualifiedTeams = [];
    for (let g of groupNums) {
       // get teams in this group
       const tRes = await client.query(`
         SELECT t.* FROM v2_teams t
         WHERE t.id IN (
            SELECT team_a_id FROM v2_matches WHERE division_id = $1 AND stage = 'initial' AND bracket_group = $2
            UNION
            SELECT team_b_id FROM v2_matches WHERE division_id = $1 AND stage = 'initial' AND bracket_group = $2
         )
         ORDER BY t.wins DESC, t.point_diff DESC
         LIMIT $3
       `, [divisionId, g, parseInt(topN, 10) || 2]);
       qualifiedTeams = qualifiedTeams.concat(tRes.rows);
    }
    
    // Sort overall qualified teams if needed, or pair them 1st group 1 vs 2nd group 2, etc.
    // For simplicity, we just take all qualified teams, sort them by overall wins -> point diff, and seed them into elimination bracket.
    qualifiedTeams.sort((a, b) => {
       if (b.wins !== a.wins) return b.wins - a.wins;
       return b.point_diff - a.point_diff;
    });

    // Create Elimination Bracket for Medal
    let matchesToInsert = [];
    const numTeams = qualifiedTeams.length;
    // We expect 4 teams for semis, 8 for quarters
    let power = hasQuarterfinals ? 8 : 4;
    
    // Slice or pad to 'power'
    let seededTeams = qualifiedTeams.slice(0, power);
    while (seededTeams.length < power) {
       seededTeams.push(null);
    }
    
    // 1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6 (Standard seeding)
    let orderedTeams = [];
    if (power === 4) {
       orderedTeams = [seededTeams[0], seededTeams[3], seededTeams[1], seededTeams[2]];
    } else if (power === 8) {
       orderedTeams = [seededTeams[0], seededTeams[7], seededTeams[3], seededTeams[4], seededTeams[1], seededTeams[6], seededTeams[2], seededTeams[5]];
    }
    
    let currentRoundNodes = [];
    let mOrder = 1;
    let rName = power === 8 ? 'Quarterfinal' : 'Semifinal';
    
    for(let i=0; i<orderedTeams.length; i+=2) {
       let m = {
          id: randomUUID(),
          division_id: divisionId,
          stage: 'medal',
          bracket_group: 1,
          match_round: 1,
          match_order: mOrder++,
          team_a_id: orderedTeams[i] ? orderedTeams[i].id : null,
          team_b_id: orderedTeams[i+1] ? orderedTeams[i+1].id : null,
          otp: generateOTP(),
          match_type: rName
       };
       if (!orderedTeams[i+1] && orderedTeams[i]) {
          m.status = 'Completed';
          m.winner_id = orderedTeams[i].id;
       }
       matchesToInsert.push(m);
       currentRoundNodes.push(m);
    }
    
    let currentRoundNum = 2;
    while (currentRoundNodes.length > 1) {
       let nextRoundNodes = [];
       mOrder = 1;
       rName = currentRoundNodes.length === 2 ? 'Final' : 'Semifinal';
       for (let i=0; i<currentRoundNodes.length; i+=2) {
          let m1 = currentRoundNodes[i];
          let m2 = currentRoundNodes[i+1];
          let newM = {
             id: randomUUID(),
             division_id: divisionId,
             stage: 'medal',
             bracket_group: 1,
             match_round: currentRoundNum,
             match_order: mOrder++,
             team_a_id: m1.winner_id || null,
             team_b_id: m2.winner_id || null,
             otp: generateOTP(),
             match_type: rName
          };
          m1.next_match_id = newM.id;
          m2.next_match_id = newM.id;
          matchesToInsert.push(newM);
          nextRoundNodes.push(newM);
       }
       currentRoundNodes = nextRoundNodes;
       currentRoundNum++;
    }
    
    for (let m of matchesToInsert) {
       await client.query(`
         INSERT INTO v2_matches (id, division_id, stage, bracket_group, match_round, match_order, team_a_id, team_b_id, otp, match_type, status, winner_id, next_match_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       `, [m.id, m.division_id, m.stage, m.bracket_group, m.match_round, m.match_order, m.team_a_id, m.team_b_id, m.otp, m.match_type, m.status || 'Pending', m.winner_id || null, m.next_match_id || null]);
    }

    await client.query('COMMIT');
    res.json({ success: true, count: matchesToInsert.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Generate medal bracket error:", err);
    res.status(500).json({ error: "Failed to generate medal bracket" });
  } finally {
    client.release();
  }
});

// Update match court
router.post('/matches/:matchId/court', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { court } = req.body;
    await pool.query('UPDATE v2_matches SET court = $1 WHERE id = $2', [court, matchId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update court" });
  }
});

// Verify OTP
router.post('/matches/:matchId/verify-otp', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { otp } = req.body;
    const result = await pool.query('SELECT otp FROM v2_matches WHERE id = $1', [matchId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Match not found" });
    if (result.rows[0].otp === otp) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid OTP" });
    }
  } catch (err) {
    res.status(500).json({ error: "OTP verification failed" });
  }
});

// Refresh OTP
router.post('/matches/:matchId/refresh-otp', async (req, res) => {
  try {
    const { matchId } = req.params;
    const newOtp = generateOTP();
    const result = await pool.query('UPDATE v2_matches SET otp = $1 WHERE id = $2 RETURNING otp', [newOtp, matchId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Match not found" });
    
    if (global.sendTournamentSSE) {
       const matchRes = await pool.query('SELECT division_id FROM v2_matches WHERE id = $1', [matchId]);
       if(matchRes.rows.length > 0) {
         global.sendTournamentSSE(matchRes.rows[0].division_id, { type: 'MATCH_UPDATE', matchId });
       }
    }
    
    res.json({ success: true, otp: newOtp });
  } catch (err) {
    res.status(500).json({ error: "Failed to refresh OTP" });
  }
});

// GET single match for scoring page
router.get('/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await pool.query(`
      SELECT m.*, 
             tA.team_name as team_a_name, tA.player1 as ta_p1, tA.player2 as ta_p2,
             tB.team_name as team_b_name, tB.player1 as tb_p1, tB.player2 as tb_p2,
             d.name as division_name, d.skill_level as division_skill, tr.name as tournament_name
      FROM v2_matches m
      LEFT JOIN v2_teams tA ON m.team_a_id = tA.id
      LEFT JOIN v2_teams tB ON m.team_b_id = tB.id
      LEFT JOIN v2_divisions d ON m.division_id = d.id
      LEFT JOIN v2_tournaments tr ON d.tournament_id = tr.id
      WHERE m.id = $1
    `, [matchId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Match not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch match" });
  }
});

// ==========================================
// SSE SUPPORT (Real-time updates)
// ==========================================
const clients = new Map();

router.get('/sse/:divisionId', (req, res) => {
  const { divisionId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  if (!clients.has(divisionId)) {
     clients.set(divisionId, new Set());
  }
  clients.get(divisionId).add(res);
  
  req.on('close', () => {
     clients.get(divisionId).delete(res);
  });
});

// Global hook for the score update route
global.sendTournamentSSE = (divisionId, data) => {
  if (clients.has(divisionId)) {
    clients.get(divisionId).forEach(res => {
       res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
};

module.exports = router;
