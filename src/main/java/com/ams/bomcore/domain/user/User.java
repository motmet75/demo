package com.ams.bomcore.domain.user;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.fasterxml.jackson.annotation.JsonIgnore;


@Entity
@Table(name = "userTB")
@Access(value=AccessType.FIELD)
public class User implements UserDetails, OAuth2User, Serializable {



	/**
	 *
	 */
	private static final long serialVersionUID = -3487740103550758866L;


	@Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id = 0;

	
//	@Transient
//    private Log loginLog;


	@Column(nullable = false, unique = true)
    private String username = "";

	@Column(nullable = false)
    private String password = "";

	@NotBlank
	@Column(name = "firstname")
    private String firstName= "";

	@NotBlank
    @Column(name = "lastname")
    private String lastName= "";

    @Column(name = "avarta")
    private String avatar= "";

    @NotBlank
    @Email
    private String email= "";

	@Column(name = "isaccountnonexpired")
	private boolean accountNonExpired = true;

	@Column(name = "isaccountnonlocked")
	private boolean accountNonLocked = true;

	@Column(name = "iscredentialsnonexpired")
	private boolean redentialsNonExpired = true;

	@Column(name = "isAllowMarketing")
	private boolean allowMarketing = false;

	@Column(name = "mailquota")
	private Integer mailQuota;


	@Column(name = "uploadquota")
	private Integer uploadQuota;

	@Column(name = "titleAndHonorific")
	private String titleAndHornorific = "";
	
	@Column(name = "phoneNumber")
	private String phoneNumber = "";
	
	@Column(name = "createdTime")
	private LocalDateTime createdTime = LocalDateTime.now();

	@Column(name = "isenabled")
	private boolean enabled = false;
	
	@Transient
	private boolean isSuspend = false;
	
	@Transient
	private Boolean secondMFA = false;
	
	@Transient
	private String secondMFAKey = "";
	
	@Transient
	private String fullName = "";
	
	@Transient
	private String fullNameFrench = "";

	@Column(name = "validationCode")
	private String validationCode = "";

	@Column(name = "leaderid", nullable = true)
	private Integer leaderId = 0;

	@Transient
	private boolean isLeader = false;

	@Transient
	private Collection<Authority> authorities ;

	@Transient
	private User user;
	
	@Transient
	 private Map<String, Object> attributes;


	@Transient
	private User leader = null;


	@Transient
	private String tenantString = "portal.tuonghoa-imex.com"; // Default tenant, can be overridden;

	@Column(name = "lastTenantId")
	private String lastTenantId;

	@Column(name = "lastCompanyId")
	private String lastCompanyId;

	/** The tenant this user is explicitly assigned to by an admin. */
	@Column(name = "assignedTenantId")
	private String assignedTenantId;

	/** The company this user is explicitly assigned to by an admin. */
	@Column(name = "assignedCompanyId")
	private String assignedCompanyId;


		
	public String getTenantString() {
		return tenantString;
	}

	public void setTenantString(String tenantString) {
		this.tenantString = tenantString;
	}

	public String getLastTenantId() {
		return lastTenantId;
	}

	public void setLastTenantId(String lastTenantId) {
		this.lastTenantId = lastTenantId;
	}

	public String getLastCompanyId() {
		return lastCompanyId;
	}

	public void setLastCompanyId(String lastCompanyId) {
		this.lastCompanyId = lastCompanyId;
	}

	public String getAssignedTenantId() {
		return assignedTenantId;
	}

	public void setAssignedTenantId(String assignedTenantId) {
		this.assignedTenantId = assignedTenantId;
	}

	public String getAssignedCompanyId() {
		return assignedCompanyId;
	}

	public void setAssignedCompanyId(String assignedCompanyId) {
		this.assignedCompanyId = assignedCompanyId;
	}

	/**
	 * @return the leaderId
	 */
	public Integer getLeaderId() {
		return leaderId;
	}

	/**
	 * @param leaderId the leaderId to set
	 */
	public void setLeaderId(Integer leaderId) {
		this.leaderId = leaderId;
	
	}


	public void setSuspend(boolean isSuspend) {
		this.isSuspend = isSuspend;
	}

	public Integer getUploadQuota() {
		return uploadQuota;
	}

	public void setUploadQuota(Integer uploadQuota) {
		this.uploadQuota = uploadQuota;
	}

	/**
	 * @return the leader
	 */
	public User getLeader() {
		return leader;
	}

	public String getFullName() {
		fullName = getFirstName() +" "+ getLastName(); 
		return fullName;
	}
	
	public String getFullNameFrench() {
		fullNameFrench = getLastName() +" "+ getFirstName();
		return fullNameFrench;
	}

	@JsonIgnore
	public String getUserAuthorityDescription() {
		String roleString = "Member";
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("ticketmanager")){
					roleString = authority.getDescription();
				}

			}
			}
		}
		return roleString;
	}




	/**
	 * @param optional the leader to set
	 */
	public void setLeader(Optional<User> optional) throws NoSuchElementException {
		try {
			if(optional.isPresent()) {
				if(optional.get()!=null) {
					this.leader = optional.get();
				}
			}
		} catch (NoSuchElementException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
//			throws
		}

	}

	public Boolean isLeader() {
		if(leader==null) {
			return true;
		}else {
			return false;
		}

	}

	public User(String username, String validationCode) {
		this.username = username;
		this.validationCode=validationCode;
	}
	
	public User(String username,String email, String validationCode) {
		this.username = username;
		this.email = email;
		this.validationCode=validationCode;
	}


	public User() {
		setUsername("guest");
	}

	public User(String email) {
		this.email = email;
	}

	public User(User user) {
		this.user = user;
	}

	public User(Integer id, String usernam, String email, String firstname, String lastname, Integer i, Integer q) {
		// TODO Auto-generated constructor stub
		setId(id);
		setUsername(usernam);
		setEmail(email);
		setFirstName(firstname);
		setLastName(lastname);
		setLastName(lastname);
		setMailQuota(i);
		setUploadQuota(q);

	}

	public User(Integer id, String usernam, String email, String firstname, String lastname, String titleAndHonorific, Integer i) {
		// TODO Auto-generated constructor stub
		setId(id);
		setUsername(usernam);
		setEmail(email);
		setFirstName(firstname);
		setLastName(lastname);
		setLastName(lastname);
		setMailQuota(i);
		setTitleAndHornorific(titleAndHonorific);
}

	public User(String email2, String fullname, List<Authority> of) {
		this.setEmail(email2);
		this.setUsername(email2);
		this.setAuthorities(of);
		
	}

	@Override
	public String getPassword() {
		// TODO Auto-generated method stub
		return password;
	}


	@Override
	public String getUsername() {
		// TODO Auto-generated method stub
		return username;
	}

	/**
	 * @param authorities the authorities to set
	 */
	public void setAuthorities(Collection<Authority> authorities) {
		this.authorities = authorities;
		if(this.authorities!=null) {
			Optional<Authority> opAuth = this.authorities.stream().filter(au -> au.getUsername().equals(username) && au.getAuthority().equals("gototp")).findAny();
			if(opAuth.isPresent() &&  opAuth.get().getDescription()!=null) {
				
				if( opAuth.get().getDescription().length()>7) {
					secondMFA = true;
					secondMFAKey = opAuth.get().getDescription();
				}else {
					secondMFA = false;
				}
			}
		}
	}

	@Override
	@JsonIgnore
	public Collection<Authority> getAuthorities() {
		// TODO Auto-generated method stub
		return  authorities ; //FIXBUG
	}

	/**
	 * @return the id
	 */
	public Integer getId() {
		return id;
	}

	/**
	 * @param id the id to set
	 */
	public void setId(Integer id) {
		this.id = id;
	}

	/**
	 * @return the isAcountNonExpired
	 */
	@Override
	public boolean isAccountNonExpired() {
		return accountNonExpired;
	}

	/**
	 * @param isAcountNonExpired the isAcountNonExpired to set
	 */
	public void setAccountNonExpired(boolean isAcountNonExpired) {
		this.accountNonExpired = isAcountNonExpired;
	}

	/**
	 * @return the isAcountNonLocked
	 */
	@Override
	public boolean isAccountNonLocked() {
		return accountNonLocked;
	}

	/**
	 * @return the isAllowMarketing
	 */
	public boolean getAllowMarketing() {
		return allowMarketing;
	}

	/**
	 * @param isAllowMarketing the isAllowMarketing to set
	 */
	public void setAllowMarketing(boolean isAllowMarketing) {
		this.allowMarketing = isAllowMarketing;
	}

	/**
	 * @param isAcountNonLocked the isAcountNonLocked to set
	 */
	public void setAccountNonLocked(boolean isAcountNonLocked) {
		this.accountNonLocked = isAcountNonLocked;
	}

	/**
	 * @return the isEnable
	 */
	@Override
	public boolean isEnabled() {
		return enabled;
	}

	/**
	 * @param isEnable the isEnable to set
	 */
	public void setEnabled(boolean isEnabled) {
		this.enabled = isEnabled;
	}

	/**
	 * @param username the username to set
	 */
	public void setUsername(String username) {
		this.username = username;
	}

	/**
	 * @param password the password to set
	 */
	public void setPassword(String password) {
		this.password = password;
	}

	/**
	 * @param isCredentialsNonExpired the isCredentialsNonExpired to set
	 */
	public void setCredentialsNonExpired(boolean isCredentialsNonExpired) {
		this.redentialsNonExpired = isCredentialsNonExpired;
	}

	/**
	 * @return the firstName
	 */
	public String getFirstName() {
		return firstName;
	}

	/**
	 * @param firstName the firstName to set
	 */
	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	/**
	 * @return the lastName
	 */
	public String getLastName() {
		return lastName;
	}

	/**
	 * @param lastName the lastName to set
	 */
	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	/**
	 * @return the email
	 */
	public String getEmail() {
		return email;
	}

	/**
	 * @param email the email to set
	 */
	public void setEmail(String email) {
		this.email = email;
	}

	@Override
	public boolean isCredentialsNonExpired() {
		// TODO Auto-generated method stub
		return redentialsNonExpired;
	}

	/**
	 * @return the mailQuota
	 */
	public Integer getMailQuota() {
		return mailQuota == null?0:mailQuota;
	}

	/**
	 * @param mailQuota the mailQuota to set
	 */
	public void setMailQuota(Integer mailQuota) {
		this.mailQuota = mailQuota;
	}

	/**
	 * @return the validationCode
	 */
	public String getValidationCode() {
		if(validationCode==null) {
			return "";
		}else {
		return validationCode;
		}
	}

	/**
	 * @param validationCode the validationCode to set
	 */
	public void setValidationCode(String validationCode) {
		this.validationCode = validationCode;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}


	  @Override
	  public int hashCode() {
	    return id;
	  }

	  @Override
	  public boolean equals(Object obj) {
	    if (this == obj) {
	      return true;
	    }
	    if (!(obj instanceof User)) {
	      return false;
	    }
	    User other = (User) obj;
	    return id == other.id;
	  }

	public boolean isTicketManaGer(User loggedUser) {
		// TODO Auto-generated method stub
		boolean isTicketManager = false;
		user = loggedUser;
		if(getAuthorities()!=null ) {
			if(getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("ticketmanager")){
					isTicketManager = true;
				}

			}
			}
		}

		return isTicketManager;
	}
	public boolean isITManager(User loggedUser) {
		// TODO Auto-generated method stub
		boolean yes = false;
		user = loggedUser;
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("itmanager")){
					yes = true;
				}

			}
			}
		}

		return yes;
	}

	public boolean isContentManager(User loggedUser) {
		// TODO Auto-generated method stub
		boolean yes = false;
		user = loggedUser;
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("contentmanager")){
					yes = true;
				}

			}
			}
		}

		return yes;
	}


	public boolean isContentTeamMember(User loggedUser) {
		// TODO Auto-generated method stub
		boolean yes = false;
		user = loggedUser;
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("contentteammember")){
					yes = true;
				}

			}
			}
		}

		return yes;
	}

	public boolean isITTeamMember(User loggedUser) {
		// TODO Auto-generated method stub
		boolean yes = false;
		user = loggedUser;
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("itteammember")){
					yes = true;
				}

			}
			}
		}

		return yes;
	}



	public List<String> getManagerAuthorities() {
		List<String> mangerAuthorities = new ArrayList<>();
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains("manager")){
					mangerAuthorities.add(authority.getAuthority().replace("manager",""));
				}

			}
		}
			}

		return mangerAuthorities;
	}

	public boolean isAuthorized(String role) {
		boolean isFound = false;
		if(getAuthorities()!=null ) {
			if( getAuthorities().size()>0) {
			for (Authority authority : getAuthorities()) {
				if(authority.getAuthority().contains(role) || authority.getAuthority().toLowerCase().contains("admin")){
					isFound = true;
				}

			}
		}
			}

		return isFound;
	}

	/**
	 * @return the titleAndHornorific
	 */
	public String getTitleAndHornorific() {
		return titleAndHornorific==null?"":titleAndHornorific;
	}

	/**
	 * @param titleAndHornorific the titleAndHornorific to set
	 */
	public void setTitleAndHornorific(String titleAndHornorific) {
		this.titleAndHornorific = titleAndHornorific;
	}


	public String getAvatar() {
		return avatar==null?"":avatar;
	}

	public void setAvatar(String avatar) {
		this.avatar = avatar;
	}

	public Boolean getSecondMFA() {
		return secondMFA;
	}

	public String getSecondMFAKey() {
		return secondMFAKey;
	}

	public void setSecondMFA(Boolean secondMFA) {
		this.secondMFA = secondMFA;
	}

	public void setSecondMFAKey(String secondMFAKey) {
		this.secondMFAKey = secondMFAKey;
	}

	public LocalDateTime getCreatedTime() {
		return createdTime==null?LocalDateTime.of(2025, 1, 1, 0, 0):createdTime;
	}

	public void setCreatedTime(LocalDateTime createdTime) {
		this.createdTime = createdTime;
	}

//	public Log getLoginLog() {
//		return loginLog;
//	}
//
//	public void setLoginLog(Log loginLog) {
//		this.loginLog = loginLog;
//	}

	public String getPhoneNumber() {
		return phoneNumber==null?"":phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public User deepCopy() {
	    User copy = new User();

	    // ID: optional depending on context. Usually not copied.
	    // copy.id = this.id;

	    copy.setId(id);
	    copy.username = this.username;
	    copy.password = this.password;
	    copy.firstName = this.firstName;
	    copy.lastName = this.lastName;
	    copy.avatar = this.avatar;
	    copy.email = this.email;

	    copy.accountNonExpired = this.accountNonExpired;
	    copy.accountNonLocked = this.accountNonLocked;
	    copy.redentialsNonExpired = this.redentialsNonExpired;
	    copy.allowMarketing = this.allowMarketing;

	    copy.mailQuota = this.mailQuota;
	    copy.uploadQuota = this.uploadQuota;
	    copy.titleAndHornorific = this.titleAndHornorific;
	    copy.enabled = this.enabled;
	    copy.isSuspend = this.isSuspend;

	    copy.validationCode = this.validationCode;
	    copy.leaderId = this.leaderId;
	    copy.isLeader = this.isLeader;

	    // Deep copy ChatBoxes (optional - depends if you need full copies)
//	    if (this.chatBoxes != null) {
//	        copy.chatBoxes = this.chatBoxes.stream()
//	                .map(chatBox -> chatBox.deepCopy()) // Assuming ChatBox has deepCopy()
//	                .collect(Collectors.toList());
//	    } else {
//	        copy.chatBoxes = new ArrayList<>();
//	    }
//
//	    // Deep copy Authorities (optional - depends if you need full copies)
//	    if (this.authorities != null) {
//	        copy.authorities = this.authorities.stream()
//	                .map(authority -> authority.deepCopy()) // Assuming Authority has deepCopy()
//	                .collect(Collectors.toList());
//	    } else {
//	        copy.authorities = new ArrayList<>();
//	    }
//
//	    // Deep copy nested user (optional)
//	    if (this.user != null) {
//	        copy.user = this.user.deepCopy();
//	    }
//
//	    // Deep copy leader (optional)
//	    if (this.leader != null) {
//	        copy.leader = this.leader.deepCopy();
//	    }

	    return copy;
	}

	 @Override
	    public Map<String, Object> getAttributes() {
	        return attributes;
	 }

	@Override
	public String getName() {
		return email;
	}

}
